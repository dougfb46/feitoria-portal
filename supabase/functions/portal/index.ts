// Portal do colaborador, no celular. Sem login de sistema: a pessoa se
// identifica com PIN + data de nascimento, e o aparelho fica vinculado.
//
// Acoes: entrar, documentos, abrir, assinar.
//
// Regras:
//   - a pessoa so enxerga documento dela ou do mural, nunca de colega;
//   - assinar exige digitar o PIN de novo: o PIN E o ato de assinatura;
//   - a assinatura guarda o sha256 do arquivo NAQUELE instante, o texto que a
//     pessoa leu, o horario do servidor, o IP e o aparelho.
//
// PERFIL DE ACESSO (employees.perfil_portal), decidido em 25/09:
//   sem_acesso   -- nao entra. Padrao de quem e cadastrado novo.
//   treinamentos -- entra so para treinamento, certificado proprio e mural.
//                   E o caso do freela: ele esta fora da escala, do ponto e da
//                   folha, mas precisa dos treinamentos.
//   completo     -- tudo o que e dele.
// O filtro do perfil e aplicado em TODAS as acoes, nao so na listagem: sem
// isso, quem tem o id de um holerite abriria o holerite direto.
//
// LIMITE DE TENTATIVAS (29/09): o PIN passa por verificar_pin_limitado, o mesmo
// contador do ponto -- 15 falhas por IP em 10 minutos. A data de nascimento
// tambem conta como falha: sem isso, quem acertasse o PIN teria tentativas
// infinitas no segundo fator, que tem poucas combinacoes plausiveis.
//
// Falha de banco NAO vira "PIN incorreto". Consulta que erra devolve 503:
// dizer a alguem que errou a senha quando o problema foi nosso e enganar.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** O texto que a pessoa le ao confirmar. Guardado junto com a assinatura. */
const TEXTO_ACEITE =
  "Declaro que li o documento acima, que estou de acordo com o seu conteudo e que " +
  "esta confirmacao, feita com o meu PIN pessoal e intransferivel, tem o valor da " +
  "minha assinatura, nos termos da Lei 14.063/2020.";

/** Erro que pede nova tentativa, nao correcao de dado pelo usuario. */
class Instavel extends Error {}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tipos de documento que o perfil "treinamentos" pode ver. Vem do banco. */
async function tiposDeTreinamento(): Promise<string[]> {
  const { data, error } = await db.from("portal_tipos_treinamento").select("tipo");
  if (error) throw new Instavel(error.message);
  return (data ?? []).map((t) => t.tipo);
}

/** Registra falha do segundo fator no mesmo contador do PIN. */
async function contarFalha(restaurantId: string, ip: string | null) {
  await db.from("pin_tentativas")
    .insert({ restaurant_id: restaurantId, origem: "portal", ip, sucesso: false });
}

async function autenticar(body: Record<string, unknown>, ip: string | null) {
  const unitToken = String(body.unit_token ?? "");
  const pin = String(body.pin ?? "");
  const nascimento = String(body.nascimento ?? "");
  const deviceHash = String(body.device_hash ?? "");

  if (!unitToken || !/^[0-9]{4,6}$/.test(pin)) return { erro: "PIN invalido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { erro: "Informe a data de nascimento." };
  if (deviceHash.length < 16) return { erro: "Aparelho nao identificado." };

  const { data: unidade, error: e1 } = await db.from("restaurants")
    .select("id, name, active").eq("public_token", unitToken).maybeSingle();
  if (e1) throw new Instavel(e1.message);
  if (!unidade || !unidade.active) return { erro: "Link invalido." };

  const { data: tentativa, error: e2 } = await db.rpc("verificar_pin_limitado", {
    _restaurant_id: unidade.id, _pin: pin, _ip: ip, _origem: "portal",
  });
  if (e2) throw new Instavel(e2.message);
  const t = (tentativa ?? {}) as {
    status?: string; employee_id?: string; espera_min?: number; restam?: number;
  };
  if (t.status === "bloqueado") {
    return {
      erro: `Muitas tentativas erradas. Espere ${t.espera_min ?? 10} minutos e tente de novo.`,
    };
  }
  if (t.status !== "ok" || !t.employee_id) {
    return { erro: "PIN ou data de nascimento incorretos." };
  }

  const { data: pessoa, error: e3 } = await db.from("employees")
    .select("id, full_name, role_title, active, nascimento, desligado_em, perfil_portal, employment_type")
    .eq("id", t.employee_id).maybeSingle();
  if (e3) throw new Instavel(e3.message);
  if (!pessoa || !pessoa.active) return { erro: "Acesso nao liberado. Procure a gestao." };

  if (!pessoa.nascimento) {
    return { erro: "Seu acesso ao portal ainda nao foi liberado. Procure a gestao." };
  }
  // Mensagem unica de proposito: nao revelar qual dos dois errou.
  if (pessoa.nascimento !== nascimento) {
    await contarFalha(unidade.id, ip);
    return { erro: "PIN ou data de nascimento incorretos." };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  if (pessoa.desligado_em && pessoa.desligado_em < hoje) {
    return { erro: "Acesso encerrado. Procure a gestao." };
  }

  // O perfil e verificado ANTES de vincular aparelho: quem nao tem acesso nao
  // deixa rastro de aparelho nem descobre se o PIN existe por outra via.
  if (pessoa.perfil_portal === "sem_acesso") {
    return { erro: "Seu acesso ao portal ainda nao foi liberado. Procure a gestao." };
  }

  // Primeiro aparelho entra sozinho. Os seguintes ficam bloqueados ate liberacao.
  const { data: aparelhos, error: e4 } = await db.from("portal_devices")
    .select("id, device_hash, liberado").eq("employee_id", pessoa.id);
  if (e4) throw new Instavel(e4.message);

  const esse = (aparelhos ?? []).find((a) => a.device_hash === deviceHash);
  if (esse) {
    if (!esse.liberado) return { erro: "Este aparelho esta bloqueado. Procure a gestao." };
    await db.from("portal_devices")
      .update({ ultimo_uso: new Date().toISOString() }).eq("id", esse.id);
  } else {
    const primeiro = (aparelhos ?? []).length === 0;
    await db.from("portal_devices").insert({
      employee_id: pessoa.id, restaurant_id: unidade.id,
      device_hash: deviceHash, liberado: primeiro,
      apelido: String(body.device_label ?? "").slice(0, 60) || null,
      bloqueado_em: primeiro ? null : new Date().toISOString(),
    });
    if (!primeiro) {
      return { erro: "Aparelho novo detectado. Procure a gestao para liberar o acesso." };
    }
  }

  return { unidade, pessoa };
}

async function documentosDe(restaurantId: string, employeeId: string, perfil: string) {
  const { data: docs, error } = await db.from("documents")
    .select("id, tipo, titulo, competencia, exige_assinatura, prazo, created_at, sha256, employee_id, visibilidade")
    .eq("restaurant_id", restaurantId)
    .is("arquivado_em", null)
    .or(`employee_id.eq.${employeeId},visibilidade.eq.mural`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Instavel(error.message);

  // Documento marcado como "so gestao" nunca aparece, mesmo sendo da pessoa.
  let visiveis = (docs ?? []).filter((d) => d.visibilidade !== "gestao");

  if (perfil === "treinamentos") {
    const tipos = await tiposDeTreinamento();
    visiveis = visiveis.filter((d) => tipos.includes(d.tipo) || d.visibilidade === "mural");
  }

  const ids = visiveis.map((d) => d.id);
  const { data: minhas } = ids.length
    ? await db.from("document_signatures")
        .select("document_id, signed_at").eq("employee_id", employeeId).in("document_id", ids)
    : { data: [] as Array<{ document_id: string; signed_at: string }> };
  const assinadoEm = new Map((minhas ?? []).map((a) => [a.document_id, a.signed_at]));

  return visiveis.map((d) => ({
    id: d.id, tipo: d.tipo, titulo: d.titulo, competencia: d.competencia,
    mural: d.employee_id === null,
    exige_assinatura: d.exige_assinatura,
    prazo: d.prazo,
    recebido_em: d.created_at,
    assinado_em: assinadoEm.get(d.id) ?? null,
    pendente: d.exige_assinatura && !assinadoEm.has(d.id),
  }));
}

/** O perfil alcanca este documento? Vale para abrir e para assinar. */
async function perfilAlcanca(
  perfil: string,
  doc: { tipo: string; visibilidade: string },
): Promise<boolean> {
  if (perfil === "completo") return true;
  if (perfil !== "treinamentos") return false;
  if (doc.visibilidade === "mural") return true;
  return (await tiposDeTreinamento()).includes(doc.tipo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  try {
    const body = await req.json();
    const auth = await autenticar(body, ip);
    if ("erro" in auth) return json({ error: auth.erro }, 401);
    const { unidade, pessoa } = auth;
    const perfil = String(pessoa.perfil_portal ?? "completo");

    if (body.action === "entrar" || body.action === "documentos") {
      const docs = await documentosDe(unidade.id, pessoa.id, perfil);
      return json({
        colaborador: { nome: pessoa.full_name, funcao: pessoa.role_title },
        unidade: { nome: unidade.name },
        perfil,
        so_treinamentos: perfil === "treinamentos",
        documentos: docs,
        pendentes: docs.filter((d) => d.pendente).length,
      });
    }

    if (body.action === "abrir") {
      const { data: doc, error } = await db.from("documents")
        .select("id, tipo, storage_path, employee_id, visibilidade, arquivado_em, titulo, sha256, exige_assinatura")
        .eq("id", body.id).eq("restaurant_id", unidade.id).maybeSingle();
      if (error) throw new Instavel(error.message);

      if (!doc || doc.arquivado_em) return json({ error: "Documento nao disponivel." }, 404);
      const meu = doc.employee_id === pessoa.id;
      const mural = doc.employee_id === null && doc.visibilidade === "mural";
      if (!meu && !mural) return json({ error: "Documento nao disponivel." }, 403);
      if (doc.visibilidade === "gestao") return json({ error: "Documento nao disponivel." }, 403);
      if (!(await perfilAlcanca(perfil, doc))) {
        return json({ error: "Documento nao disponivel no seu acesso." }, 403);
      }

      const { data: link, error: erroLink } = await db.storage.from("documentos")
        .createSignedUrl(doc.storage_path, 300);
      if (erroLink) return json({ error: "Nao foi possivel abrir o arquivo." }, 500);

      const { data: assinatura } = await db.from("document_signatures")
        .select("signed_at, hash").eq("document_id", doc.id).eq("employee_id", pessoa.id).maybeSingle();

      return json({
        titulo: doc.titulo,
        url: link.signedUrl,
        expira_em_segundos: 300,
        exige_assinatura: doc.exige_assinatura,
        ja_assinei: Boolean(assinatura),
        assinado_em: assinatura?.signed_at ?? null,
        comprovante: assinatura ? assinatura.hash.slice(0, 8).toUpperCase() : null,
        texto_aceite: TEXTO_ACEITE,
      });
    }

    if (body.action === "assinar") {
      const { data: doc, error: e1 } = await db.from("documents")
        .select("id, tipo, visibilidade, storage_path, employee_id, exige_assinatura, arquivado_em, titulo")
        .eq("id", body.id).eq("restaurant_id", unidade.id).maybeSingle();
      if (e1) throw new Instavel(e1.message);

      if (!doc || doc.arquivado_em) return json({ error: "Documento nao disponivel." }, 404);
      if (doc.employee_id !== pessoa.id) return json({ error: "Este documento nao e seu." }, 403);
      if (!doc.exige_assinatura) return json({ error: "Este documento nao pede assinatura." }, 400);
      if (!(await perfilAlcanca(perfil, doc))) {
        return json({ error: "Documento nao disponivel no seu acesso." }, 403);
      }

      const { data: ja } = await db.from("document_signatures")
        .select("id").eq("document_id", doc.id).eq("employee_id", pessoa.id).maybeSingle();
      if (ja) return json({ error: "Voce ja assinou este documento." }, 409);

      // O sha256 e recalculado do arquivo AGORA, nao copiado do cadastro:
      // e isso que prova que o que foi assinado e o que esta guardado.
      const { data: arquivo, error: erroBaixa } = await db.storage
        .from("documentos").download(doc.storage_path);
      if (erroBaixa || !arquivo) return json({ error: "Nao foi possivel ler o arquivo." }, 500);
      const digest = await sha256(new Uint8Array(await arquivo.arrayBuffer()));

      const { data: assinatura, error } = await db.from("document_signatures").insert({
        document_id: doc.id,
        restaurant_id: unidade.id,
        employee_id: pessoa.id,
        employee_name: pessoa.full_name,
        sha256_no_ato: digest,
        texto_aceite: TEXTO_ACEITE,
        ip,
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200),
        device_label: String(body.device_label ?? "").slice(0, 60) || null,
      }).select("signed_at, hash").single();

      if (error) return json({ error: "Nao foi possivel registrar a assinatura." }, 500);

      return json({
        ok: true,
        titulo: doc.titulo,
        assinado_em: assinatura.signed_at,
        comprovante: assinatura.hash.slice(0, 8).toUpperCase(),
      });
    }

    return json({ error: "Acao desconhecida." }, 400);
  } catch (e) {
    if (e instanceof Instavel) {
      return json({
        error: "Instabilidade momentanea. Tente de novo em alguns segundos.",
        instavel: true,
      }, 503);
    }
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});
