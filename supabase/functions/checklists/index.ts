// Checklists K01..K17. Dois publicos na mesma funcao, como a `operacao`:
//
//   equipe (token da unidade + PIN):
//     modelos    -- o que tem para fazer neste turno
//     iniciar    -- abre a execucao e devolve o corpo do modelo
//     responder  -- grava uma resposta; com `corrige`, grava uma correcao
//     concluir   -- fecha, calcula a nota e abre as ocorrencias
//   gestao (login de dono ou gerente):
//     painel     -- indicadores, execucoes e ocorrencias abertas
//     importar   -- importa o JSON do modelo; cria VERSAO nova
//     revisar    -- aprova ou reprova uma execucao
//     ocorrencia -- trata uma ocorrencia
//
// REGRAS QUE O CODIGO SUSTENTA, e que vieram do papel:
//
// - Resposta nao e editada por cima. O banco recusa UPDATE; correcao entra
//   como linha nova apontando para a anterior, com autor e motivo. Vale a
//   ultima; o historico fica inteiro. E isso que permite "corrigir e reenviar
//   mais pra frente" sem reescrever o que foi respondido na hora.
// - Modelo e versionado. Importar de novo cria versao nova e desativa a
//   anterior; execucao ja feita continua apontando para a versao usada.
// - LIMITE NUMERICO NUNCA E INVENTADO. Item com `exige_cadastro` e sem
//   limites e aceito, marcado, e aparece no painel como pendente de cadastro.
//   Melhor registrar que o numero nao existe do que fingir um.
// - Item critico nao aceita "nao se aplica".

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const SO_GESTAO = ["painel", "importar", "revisar", "ocorrencia"];

class Instavel extends Error {}

function ipDe(req: Request): string | null {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
}

async function unidadePorToken(token: string) {
  if (!token) return null;
  const { data, error } = await db.from("restaurants")
    .select("id, name, active").eq("public_token", token).maybeSingle();
  if (error) throw new Instavel(error.message);
  return data && data.active ? data : null;
}

async function gestor(req: Request, restaurantId: string) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: papeis } = await db.from("user_roles")
    .select("role, restaurant_id").eq("user_id", data.user.id);
  const manda = (papeis ?? []).filter((p) => p.role === "dono" || p.role === "gerente");
  if (!manda.length) return null;
  const global = manda.some((p) => p.role === "dono" && !p.restaurant_id);
  const unidades = manda.map((p) => p.restaurant_id).filter(Boolean) as string[];
  if (!global && !unidades.includes(restaurantId)) return null;
  return { userId: data.user.id };
}

/** Quem esta executando: PIN com o mesmo teto de tentativas do ponto. */
async function pessoaPorPin(req: Request, unidadeId: string, pin: string) {
  if (!/^[0-9]{4,6}$/.test(pin)) return { erro: "Digite seu PIN." };
  const { data: veredito, error } = await db.rpc("verificar_pin_limitado", {
    _restaurant_id: unidadeId, _pin: pin, _ip: ipDe(req), _origem: "checklist",
  });
  if (error) throw new Instavel(error.message);
  const r = veredito as { status: string; employee_id?: string; espera_min?: number };
  if (r.status === "bloqueado") {
    return { erro: `Muitas tentativas erradas. Espere ${r.espera_min ?? 10} minutos.` };
  }
  if (r.status !== "ok" || !r.employee_id) return { erro: "PIN incorreto." };
  const { data: p } = await db.from("employees")
    .select("id, full_name, active").eq("id", r.employee_id).maybeSingle();
  if (!p || !p.active) return { erro: "Acesso nao liberado. Procure a gestao." };
  return { id: p.id, nome: p.full_name };
}

async function diaOperacional(): Promise<string> {
  const { data, error } = await db.rpc("data_operacional", { p_ts: new Date().toISOString() });
  if (error) throw new Instavel(error.message);
  return data as unknown as string;
}

/** Acha o item dentro do corpo do modelo, inclusive nas tabelas. */
function itemDoModelo(corpo: Record<string, unknown>, itemId: string) {
  for (const g of (corpo.grupos ?? []) as Array<Record<string, unknown>>) {
    for (const i of (g.itens ?? []) as Array<Record<string, unknown>>) {
      if (i.id === itemId) return i;
    }
  }
  for (const t of (corpo.tabelas ?? []) as Array<Record<string, unknown>>) {
    if (t.id === itemId) return { ...t, resposta: "tabela" };
    for (const c of (t.colunas ?? []) as Array<Record<string, unknown>>) {
      if (`${t.id}.${c.id}` === itemId) return { ...c, id: itemId, resposta: c.tipo };
    }
  }
  return null;
}

function foraDoLimite(item: Record<string, unknown>, valor: Record<string, unknown>) {
  const lim = item.limites as { minimo?: number; maximo?: number } | null;
  if (!lim || typeof valor.numero !== "number") return false;
  if (typeof lim.minimo === "number" && valor.numero < lim.minimo) return true;
  if (typeof lim.maximo === "number" && valor.numero > lim.maximo) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const acao = String(body.action ?? "");
    const unidade = await unidadePorToken(String(body.unit_token ?? ""));
    if (!unidade) return json({ error: "Link invalido." }, 404);

    /* ---------------- gestao ---------------- */
    if (SO_GESTAO.includes(acao)) {
      const autor = await gestor(req, unidade.id);
      if (!autor) return json({ error: "Acesso nao liberado para este usuario." }, 403);

      if (acao === "importar") {
        const m = body.modelo as Record<string, unknown>;
        if (!m || typeof m.codigo !== "string" || typeof m.titulo !== "string") {
          return json({ error: "Modelo invalido: falta codigo ou titulo." }, 400);
        }
        if (!Array.isArray(m.grupos) && !Array.isArray(m.tabelas)) {
          return json({ error: "Modelo sem grupos nem tabelas." }, 400);
        }
        const { data: anterior } = await db.from("checklist_modelos")
          .select("versao").eq("codigo", m.codigo).order("versao", { ascending: false }).limit(1);
        const versao = (anterior?.[0]?.versao ?? 0) + 1;

        await db.from("checklist_modelos").update({ ativo: false }).eq("codigo", m.codigo);

        const { error } = await db.from("checklist_modelos").insert({
          codigo: m.codigo, versao,
          titulo: m.titulo, quando: m.quando ?? null,
          setor: m.setor ?? null, frequencia: m.frequencia ?? null,
          turnos: m.turnos ?? [], unidades: m.unidades ?? [],
          responsavel_padrao: m.responsavel_padrao ?? null,
          exige_revisao: Boolean(m.exige_revisao),
          nota_final: m.nota_final ?? null,
          corpo: { grupos: m.grupos ?? [], tabelas: m.tabelas ?? [] },
          observacoes_livres: m.observacoes_livres !== false,
          assinaturas: m.assinaturas ?? [],
          importado_por: autor.userId,
        });
        if (error) return json({ error: "Nao foi possivel importar: " + error.message }, 500);

        // itens sem limite que dependem de limite: a gestao precisa saber
        const pendentes: string[] = [];
        for (const g of (m.grupos ?? []) as Array<Record<string, unknown>>) {
          for (const i of (g.itens ?? []) as Array<Record<string, unknown>>) {
            if (i.exige_cadastro) pendentes.push(String(i.texto ?? i.id));
          }
        }
        return json({ ok: true, codigo: m.codigo, versao, exigem_cadastro: pendentes });
      }

      if (acao === "painel") {
        const dia = await diaOperacional();
        const desde = body.desde && /^\d{4}-\d{2}-\d{2}$/.test(body.desde)
          ? body.desde
          : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

        const { data: modelos } = await db.from("checklist_modelos")
          .select("id, codigo, versao, titulo, quando, setor, frequencia, turnos, exige_revisao")
          .eq("ativo", true).order("codigo");

        const { data: execs } = await db.from("checklist_execucoes")
          .select("id, codigo, versao, business_date, turno, employee_nome, situacao, nota, concluido_em")
          .eq("restaurant_id", unidade.id).gte("business_date", desde)
          .order("business_date", { ascending: false }).limit(400);

        const { data: ocor } = await db.from("checklist_ocorrencias")
          .select("id, execucao_id, item_id, texto, criticidade, responsavel, prazo, situacao, criado_em")
          .eq("restaurant_id", unidade.id).in("situacao", ["aberta", "em_tratamento"])
          .order("criticidade").order("prazo", { nullsFirst: false }).limit(200);

        // reprovacoes por item, para achar o que repete
        const ids = (execs ?? []).map((e) => e.id);
        const { data: naoConformes } = ids.length
          ? await db.from("vw_checklist_respostas_atuais")
              .select("execucao_id, item_id, valor, fora_do_limite").in("execucao_id", ids)
          : { data: [] as Array<Record<string, unknown>> };

        const repete = new Map<string, number>();
        for (const r of naoConformes ?? []) {
          const v = r.valor as Record<string, unknown>;
          const ruim = v?.conforme === false || r.fora_do_limite === true;
          if (ruim) repete.set(r.item_id as string, (repete.get(r.item_id as string) ?? 0) + 1);
        }

        const hoje = (execs ?? []).filter((e) => e.business_date === dia);
        return json({
          dia_operacional: dia,
          modelos: modelos ?? [],
          execucoes: execs ?? [],
          hoje: { feitos: hoje.length, previstos: (modelos ?? []).length },
          ocorrencias: ocor ?? [],
          repetem: [...repete.entries()]
            .filter(([, n]) => n > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([item_id, vezes]) => ({ item_id, vezes })),
          esperando_revisao: (execs ?? []).filter((e) => e.situacao === "em_revisao").length,
        });
      }

      if (acao === "revisar") {
        const situacao = body.aprovar ? "aprovada" : "reprovada";
        const { error } = await db.from("checklist_execucoes").update({
          situacao, revisado_por: autor.userId, revisado_em: new Date().toISOString(),
          revisao_motivo: String(body.motivo ?? "").slice(0, 500) || null,
        }).eq("id", body.id).eq("restaurant_id", unidade.id);
        if (error) return json({ error: "Nao foi possivel revisar." }, 500);
        return json({ ok: true });
      }

      if (acao === "ocorrencia") {
        const situacao = String(body.situacao ?? "");
        if (!["aberta", "em_tratamento", "resolvida", "ignorada"].includes(situacao)) {
          return json({ error: "Situacao invalida." }, 400);
        }
        const campos: Record<string, unknown> = { situacao };
        if (body.responsavel !== undefined) campos.responsavel = String(body.responsavel).slice(0, 120) || null;
        if (body.prazo !== undefined) campos.prazo = body.prazo || null;
        if (body.resolucao !== undefined) {
          campos.resolucao = String(body.resolucao).slice(0, 1000) || null;
          campos.resolvido_por = autor.userId;
          campos.resolvido_em = new Date().toISOString();
        }
        const { error } = await db.from("checklist_ocorrencias")
          .update(campos).eq("id", body.id).eq("restaurant_id", unidade.id);
        if (error) return json({ error: "Nao foi possivel atualizar a ocorrencia." }, 500);
        return json({ ok: true });
      }
    }

    /* ---------------- equipe ---------------- */

    if (acao === "modelos") {
      const dia = await diaOperacional();
      const { data: modelos, error } = await db.from("checklist_modelos")
        .select("id, codigo, versao, titulo, quando, setor, frequencia, turnos, responsavel_padrao")
        .eq("ativo", true).order("codigo");
      if (error) throw new Instavel(error.message);

      const { data: feitos } = await db.from("checklist_execucoes")
        .select("codigo, turno, situacao")
        .eq("restaurant_id", unidade.id).eq("business_date", dia);

      return json({
        unidade: { nome: unidade.name },
        dia_operacional: dia,
        modelos: (modelos ?? []).map((m) => ({
          ...m,
          feito_hoje: (feitos ?? []).some((f) => f.codigo === m.codigo && f.situacao !== "em_andamento"),
        })),
      });
    }

    if (acao === "iniciar") {
      const quem = await pessoaPorPin(req, unidade.id, String(body.pin ?? ""));
      if ("erro" in quem) return json({ error: quem.erro }, 401);

      const { data: modelo, error } = await db.from("checklist_modelos")
        .select("*").eq("codigo", body.codigo).eq("ativo", true).maybeSingle();
      if (error) throw new Instavel(error.message);
      if (!modelo) return json({ error: "Checklist nao encontrado." }, 404);

      const dia = await diaOperacional();
      const turno = body.turno === "almoco" ? "almoco" : "noite";

      // retomar uma execucao em andamento da mesma pessoa, em vez de duplicar
      const { data: aberta } = await db.from("checklist_execucoes")
        .select("id").eq("restaurant_id", unidade.id).eq("codigo", modelo.codigo)
        .eq("business_date", dia).eq("turno", turno)
        .eq("employee_id", quem.id).eq("situacao", "em_andamento").maybeSingle();

      let execucaoId = aberta?.id as string | undefined;
      if (!execucaoId) {
        const { data: nova, error: e2 } = await db.from("checklist_execucoes").insert({
          restaurant_id: unidade.id, modelo_id: modelo.id,
          codigo: modelo.codigo, versao: modelo.versao,
          business_date: dia, turno,
          employee_id: quem.id, employee_nome: quem.nome,
        }).select("id").single();
        if (e2) return json({ error: "Nao foi possivel abrir o checklist." }, 500);
        execucaoId = nova.id;
      }

      const { data: respostas } = await db.from("vw_checklist_respostas_atuais")
        .select("id, item_id, linha, valor, nao_aplicavel, observacao, fora_do_limite")
        .eq("execucao_id", execucaoId);

      return json({
        execucao_id: execucaoId,
        retomada: Boolean(aberta),
        colaborador: { nome: quem.nome },
        modelo: {
          codigo: modelo.codigo, versao: modelo.versao, titulo: modelo.titulo,
          quando: modelo.quando, corpo: modelo.corpo, nota_final: modelo.nota_final,
          observacoes_livres: modelo.observacoes_livres, assinaturas: modelo.assinaturas,
          exige_revisao: modelo.exige_revisao,
        },
        respostas: respostas ?? [],
      });
    }

    if (acao === "responder") {
      const quem = await pessoaPorPin(req, unidade.id, String(body.pin ?? ""));
      if ("erro" in quem) return json({ error: quem.erro }, 401);

      const { data: exec } = await db.from("checklist_execucoes")
        .select("id, modelo_id, situacao").eq("id", body.execucao_id)
        .eq("restaurant_id", unidade.id).maybeSingle();
      if (!exec) return json({ error: "Checklist nao encontrado." }, 404);
      if (exec.situacao === "aprovada") {
        return json({ error: "Este checklist ja foi aprovado. Fale com a gestao." }, 409);
      }

      const { data: modelo } = await db.from("checklist_modelos")
        .select("corpo").eq("id", exec.modelo_id).maybeSingle();
      const item = itemDoModelo((modelo?.corpo ?? {}) as Record<string, unknown>, String(body.item_id ?? ""));
      if (!item) return json({ error: "Item nao existe neste checklist." }, 400);

      const naoAplicavel = body.nao_aplicavel === true;
      if (naoAplicavel && (item.criticidade === "critica" || item.permite_nao_aplicavel === false)) {
        return json({ error: "Item critico nao aceita 'nao se aplica'." }, 400);
      }

      const valor = (body.valor ?? {}) as Record<string, unknown>;

      // Evidencia: a foto entra no bucket privado, nunca em URL fixa.
      let evidencia: string | null = null;
      if (typeof body.foto === "string" && body.foto.startsWith("data:image/")) {
        const m = /^data:(image\/\w+);base64,([A-Za-z0-9+/=]+)$/.exec(body.foto);
        if (!m) return json({ error: "Foto invalida." }, 400);
        const bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const caminho = `${unidade.id}/${exec.id}/${body.item_id}-${Date.now()}.jpg`;
        const { error: eUp } = await db.storage.from("checklists")
          .upload(caminho, bytes, { contentType: m[1], upsert: false });
        if (eUp) return json({ error: "Nao foi possivel guardar a foto." }, 500);
        evidencia = caminho;
      }
      if (item.evidencia === "foto_obrigatoria" && !evidencia && !naoAplicavel) {
        return json({ error: "Este item pede foto." }, 400);
      }

      // Correcao: confere que a resposta corrigida e desta execucao.
      let corrige: number | null = null;
      if (body.corrige) {
        const { data: ant } = await db.from("checklist_respostas")
          .select("id").eq("id", body.corrige).eq("execucao_id", exec.id).maybeSingle();
        if (!ant) return json({ error: "Resposta anterior nao encontrada." }, 404);
        corrige = ant.id;
        if (!String(body.motivo ?? "").trim()) {
          return json({ error: "Escreva o motivo da correcao." }, 400);
        }
      }

      const { data: gravada, error } = await db.from("checklist_respostas").insert({
        execucao_id: exec.id,
        item_id: String(body.item_id),
        linha: body.linha ? String(body.linha).slice(0, 120) : null,
        valor, nao_aplicavel: naoAplicavel,
        observacao: body.observacao ? String(body.observacao).slice(0, 1000) : null,
        evidencia_path: evidencia,
        fora_do_limite: foraDoLimite(item, valor),
        corrige, motivo: body.motivo ? String(body.motivo).slice(0, 500) : null,
        autor_employee_id: quem.id, autor_nome: quem.nome,
      }).select("id, fora_do_limite").single();

      if (error) {
        if (String(error.message).includes("checklist_respostas_corrige_unico")) {
          return json({ error: "Esta resposta ja foi corrigida. Recarregue a tela." }, 409);
        }
        return json({ error: "Nao foi possivel gravar: " + error.message }, 500);
      }

      return json({
        ok: true, id: gravada.id, fora_do_limite: gravada.fora_do_limite,
        sem_limite_cadastrado: Boolean(item.exige_cadastro && !item.limites),
      });
    }

    if (acao === "concluir") {
      const quem = await pessoaPorPin(req, unidade.id, String(body.pin ?? ""));
      if ("erro" in quem) return json({ error: quem.erro }, 401);

      const { data: exec } = await db.from("checklist_execucoes")
        .select("id, modelo_id, codigo, situacao").eq("id", body.execucao_id)
        .eq("restaurant_id", unidade.id).maybeSingle();
      if (!exec) return json({ error: "Checklist nao encontrado." }, 404);
      if (exec.situacao !== "em_andamento") return json({ error: "Este checklist ja foi fechado." }, 409);

      const { data: modelo } = await db.from("checklist_modelos")
        .select("corpo, nota_final, exige_revisao").eq("id", exec.modelo_id).maybeSingle();
      const corpo = (modelo?.corpo ?? {}) as Record<string, unknown>;

      // Item critico sem resposta trava o fechamento: o buraco nao pode passar.
      const { data: respostas } = await db.from("vw_checklist_respostas_atuais")
        .select("item_id, valor, nao_aplicavel, fora_do_limite, observacao")
        .eq("execucao_id", exec.id);
      const respondidos = new Set((respostas ?? []).map((r) => r.item_id));

      const faltando: string[] = [];
      const problemas: Array<{ item_id: string; texto: string; criticidade: string }> = [];
      for (const g of (corpo.grupos ?? []) as Array<Record<string, unknown>>) {
        for (const i of (g.itens ?? []) as Array<Record<string, unknown>>) {
          const id = String(i.id);
          if (!respondidos.has(id)) {
            if (i.criticidade === "critica") faltando.push(String(i.texto ?? id));
            continue;
          }
          const r = (respostas ?? []).find((x) => x.item_id === id)!;
          const v = r.valor as Record<string, unknown>;
          const ruim = v?.conforme === false || r.fora_do_limite === true;
          if (ruim && (i.abre_ocorrencia_se_nao_conforme || i.criticidade === "critica")) {
            problemas.push({ item_id: id, texto: String(i.texto ?? id), criticidade: String(i.criticidade ?? "normal") });
          }
        }
      }
      if (faltando.length) {
        return json({ error: "Faltam itens criticos sem resposta.", faltando }, 400);
      }

      const nf = modelo?.nota_final as { usa?: boolean; justifica_abaixo_de?: number } | null;
      let nota: number | null = null;
      if (nf?.usa) {
        nota = Number(body.nota);
        if (!(nota >= 0 && nota <= 10)) return json({ error: "Informe a nota de 0 a 10." }, 400);
        if (typeof nf.justifica_abaixo_de === "number" && nota < nf.justifica_abaixo_de
            && !String(body.justificativa ?? "").trim()) {
          return json({ error: `Nota abaixo de ${nf.justifica_abaixo_de} pede justificativa escrita.` }, 400);
        }
      }

      for (const p of problemas) {
        await db.from("checklist_ocorrencias").insert({
          restaurant_id: unidade.id, execucao_id: exec.id,
          item_id: p.item_id, texto: p.texto, criticidade: p.criticidade,
        });
      }

      const situacao = modelo?.exige_revisao ? "em_revisao" : "concluida";
      const { error } = await db.from("checklist_execucoes").update({
        situacao, nota,
        justificativa: body.justificativa ? String(body.justificativa).slice(0, 1000) : null,
        observacoes: body.observacoes ? String(body.observacoes).slice(0, 2000) : null,
        concluido_em: new Date().toISOString(),
      }).eq("id", exec.id);
      if (error) return json({ error: "Nao foi possivel fechar o checklist." }, 500);

      return json({
        ok: true, situacao, nota,
        ocorrencias_abertas: problemas.length,
        mensagem: problemas.length
          ? `Checklist fechado. ${problemas.length} item(ns) foram para a gestao resolver.`
          : situacao === "em_revisao"
            ? "Checklist fechado e enviado para a liderança conferir."
            : "Checklist fechado. Obrigado.",
      });
    }

    return json({ error: "Acao desconhecida." }, 400);
  } catch (e) {
    if (e instanceof Instavel) {
      return json({ error: "Instabilidade momentanea. Tente de novo em alguns segundos.", instavel: true }, 503);
    }
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});
