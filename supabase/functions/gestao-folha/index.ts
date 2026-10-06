// Folha de ponto: apuracao do periodo e geracao do PDF.
// Exige login e papel de dono ou gerente.
//
// Acoes: parametros, salvar_parametros, folha, folha_pdf.
//
// Os percentuais vem de payroll_settings, NAO do codigo: o enquadramento
// sindical da Feitoria esta em disputa e o numero pode mudar de 50% para 100%.
//
// Correcao: marcacao corrigida por outra e ignorada na apuracao, mas continua
// no banco. O que vale e a ultima versao; o historico fica para prova.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { gerarPdf, type Bloco } from "../_shared/pdf.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TZ = "America/Sao_Paulo";

async function quemE(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: papeis } = await db.from("user_roles")
    .select("role, restaurant_id").eq("user_id", data.user.id);
  const manda = (papeis ?? []).filter((p) => p.role === "dono" || p.role === "gerente");
  if (!manda.length) return null;
  return {
    userId: data.user.id,
    unidades: manda.map((p) => p.restaurant_id).filter(Boolean) as string[],
    global: manda.some((p) => p.role === "dono" && !p.restaurant_id),
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** minutos -> "7:20". */
const hm = (min: number) => {
  const neg = min < 0; const m = Math.abs(Math.round(min));
  return `${neg ? "-" : ""}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
});
/** Hora local (Sao Paulo) de um instante, em minutos desde a meia-noite. */
function minutosLocais(iso: string): number {
  const p = fmtHora.formatToParts(new Date(iso));
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}
const hhmm = (iso: string) => fmtHora.format(new Date(iso));

/**
 * Minutos trabalhados dentro da janela noturna (22h as 5h, por padrao).
 * Conta por aritmetica a partir da hora local de entrada -- sem varrer minuto
 * a minuto, que custaria milhares de conversoes de fuso por relatorio.
 */
function minutosNoturnos(inicioIso: string, fimIso: string, inicioNoturno: number): number {
  const dur = Math.round((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60000);
  if (dur <= 0) return 0;
  const inicio = minutosLocais(inicioIso);
  const noturno = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return m >= inicioNoturno || m < 300; };
  // Dias inteiros primeiro (turno improvavel, mas barato de cobrir).
  const porDia = Math.max(0, 1440 - inicioNoturno) + 300;
  let total = Math.floor(dur / 1440) * porDia;
  const resto = dur % 1440;
  for (let k = 0; k < resto; k++) if (noturno(inicio + k)) total++;
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const autor = await quemE(req);
    if (!autor) return json({ error: "Acesso nao liberado para este usuario." }, 403);

    const body = await req.json();
    const acao = String(body.action ?? "");
    const restaurantId = String(body.restaurant_id ?? "");
    if (!restaurantId) return json({ error: "Informe a unidade." }, 400);
    if (!autor.global && !autor.unidades.includes(restaurantId)) {
      return json({ error: "Voce nao administra esta unidade." }, 403);
    }

    const { data: params } = await db.from("payroll_settings")
      .select("*").eq("restaurant_id", restaurantId)
      .order("vigencia_inicio", { ascending: false }).limit(1).maybeSingle();

    if (acao === "parametros") return json({ parametros: params });

    if (acao === "salvar_parametros") {
      const campos = {
        restaurant_id: restaurantId,
        vigencia_inicio: body.vigencia_inicio || new Date().toISOString().slice(0, 10),
        he_percentual: Number(body.he_percentual ?? 50),
        he_percentual_2: body.he_percentual_2 ? Number(body.he_percentual_2) : null,
        noturno_percentual: Number(body.noturno_percentual ?? 20),
        noturno_inicio: body.noturno_inicio || "22:00",
        hora_noturna_reduzida: body.hora_noturna_reduzida !== false,
        tolerancia_marcacao_min: Number(body.tolerancia_marcacao_min ?? 5),
        tolerancia_dia_min: Number(body.tolerancia_dia_min ?? 10),
        banco_de_horas: Boolean(body.banco_de_horas),
        convencao: body.convencao ?? null,
        observacao: body.observacao ?? null,
      };
      // Linha nova a cada mudanca: o periodo ja apurado continua reproduzivel.
      const { error } = await db.from("payroll_settings").insert(campos);
      if (error) return json({ error: "Nao foi possivel salvar: " + error.message }, 500);
      return json({ ok: true });
    }

    if (acao !== "folha" && acao !== "folha_pdf") {
      return json({ error: "Acao desconhecida." }, 400);
    }

    const inicio = String(body.inicio ?? "").slice(0, 10);
    const fim = String(body.fim ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
      return json({ error: "Informe o período." }, 400);
    }

    const { data: pessoa } = await db.from("employees")
      .select("id, full_name, role_title").eq("id", body.employee_id)
      .eq("restaurant_id", restaurantId).maybeSingle();
    if (!pessoa) return json({ error: "Colaborador nao encontrado nesta unidade." }, 404);

    const { data: ficha } = await db.from("employee_records")
      .select("jornada_semanal_horas, dias_por_semana, cargo, cpf")
      .eq("employee_id", pessoa.id).maybeSingle();

    const semanais = Number(ficha?.jornada_semanal_horas ?? 44);
    const diasSemana = Number(ficha?.dias_por_semana ?? 6);
    const esperadoDia = Math.round((semanais * 60) / diasSemana);   // 44h/6 = 440 min = 7h20

    const { data: marcacoes } = await db.from("time_entries")
      .select("id, seq, kind, occurred_at, business_date, corrige_id, corrige_motivo, autor_tipo")
      .eq("restaurant_id", restaurantId).eq("employee_id", pessoa.id)
      .gte("business_date", inicio).lte("business_date", fim)
      .order("seq");

    // Marcacao substituida por correcao nao entra na conta.
    const substituidas = new Set((marcacoes ?? []).map((m) => m.corrige_id).filter(Boolean));
    const validas = (marcacoes ?? []).filter((m) => !substituidas.has(m.id));

    const porDia = new Map<string, typeof validas>();
    for (const m of validas) {
      const l = porDia.get(m.business_date) ?? [];
      l.push(m); porDia.set(m.business_date, l);
    }

    const tolDia = Number(params?.tolerancia_dia_min ?? 10);
    const noturnoInicio = String(params?.noturno_inicio ?? "22:00");
    const minNoturno = Number(noturnoInicio.slice(0, 2)) * 60 + Number(noturnoInicio.slice(3, 5));
    const reduzida = params?.hora_noturna_reduzida !== false;

    const dias: Array<Record<string, string>> = [];
    let somaTrabalhado = 0, somaExtra = 0, somaDebito = 0, somaNoturno = 0, somaIntervalo = 0;

    // Percorre todo o periodo, inclusive os dias sem marcacao.
    for (let d = new Date(inicio + "T12:00:00Z"); d <= new Date(fim + "T12:00:00Z");
         d.setUTCDate(d.getUTCDate() + 1)) {
      const dia = d.toISOString().slice(0, 10);
      const lista = porDia.get(dia) ?? [];
      const pega = (k: string) => lista.find((m) => m.kind === k);

      const e1 = pega("entrada"), s1 = pega("intervalo_inicio");
      const e2 = pega("intervalo_fim"), s2 = pega("saida");

      let trabalhado = 0, intervalo = 0, noturno = 0;
      let observacao = "";

      if (e1 && s2) {
        const completo = Boolean(s1 && e2);
        if (completo) {
          const b1 = (new Date(s1!.occurred_at).getTime() - new Date(e1.occurred_at).getTime()) / 60000;
          const b2 = (new Date(s2.occurred_at).getTime() - new Date(e2!.occurred_at).getTime()) / 60000;
          trabalhado = b1 + b2;
          intervalo = (new Date(e2!.occurred_at).getTime() - new Date(s1!.occurred_at).getTime()) / 60000;
          noturno = minutosNoturnos(e1.occurred_at, s1!.occurred_at, minNoturno)
                  + minutosNoturnos(e2!.occurred_at, s2.occurred_at, minNoturno);
        } else {
          trabalhado = (new Date(s2.occurred_at).getTime() - new Date(e1.occurred_at).getTime()) / 60000;
          noturno = minutosNoturnos(e1.occurred_at, s2.occurred_at, minNoturno);
          observacao = "Sem intervalo registrado";
        }
      } else if (lista.length) {
        observacao = "Registro incompleto — conferir";
      } else {
        observacao = "Sem marcação";
      }

      if (lista.some((m) => m.autor_tipo === "gestor")) {
        observacao = (observacao ? observacao + " · " : "") + "tem correção";
      }

      // Tolerancia: diferenca de ate 10 min no dia nao vira extra nem atraso.
      let extra = 0, debito = 0;
      if (trabalhado > 0) {
        const dif = trabalhado - esperadoDia;
        if (Math.abs(dif) > tolDia) { if (dif > 0) extra = dif; else debito = -dif; }
      }

      somaTrabalhado += trabalhado; somaExtra += extra; somaDebito += debito;
      somaNoturno += noturno; somaIntervalo += intervalo;

      const dow = new Date(dia + "T12:00:00Z").getUTCDay();
      dias.push({
        data: dia,
        rotulo: `${DIAS[dow]}, ${dia.slice(8)}/${dia.slice(5, 7)}`,
        e1: e1 ? hhmm(e1.occurred_at) : "",
        s1: s1 ? hhmm(s1.occurred_at) : "",
        e2: e2 ? hhmm(e2.occurred_at) : "",
        s2: s2 ? hhmm(s2.occurred_at) : "",
        intervalo: intervalo ? hm(intervalo) : "",
        trabalhado: trabalhado ? hm(trabalhado) : "",
        extra: extra ? hm(extra) : "",
        debito: debito ? hm(debito) : "",
        noturno: noturno ? hm(noturno) : "",
        observacao,
      });
    }

    // Hora noturna reduzida (CLT art. 73 § 1o): 52'30" valem 60'.
    const noturnoPago = reduzida ? somaNoturno * (60 / 52.5) : somaNoturno;

    const resumo = {
      trabalhado: hm(somaTrabalhado),
      extras: hm(somaExtra),
      debito: hm(somaDebito),
      noturno: hm(somaNoturno),
      noturno_reduzido: hm(noturnoPago),
      hora_noturna_reduzida: reduzida,
      intervalo: hm(somaIntervalo),
      esperado_dia: hm(esperadoDia),
      he_percentual: Number(params?.he_percentual ?? 50),
      noturno_percentual: Number(params?.noturno_percentual ?? 20),
      noturno_inicio: noturnoInicio,
      tolerancia_dia_min: tolDia,
      convencao: params?.convencao ?? null,
      parametros_confirmados: Boolean(params?.convencao),
    };

    if (acao === "folha") {
      return json({
        colaborador: { nome: pessoa.full_name, cargo: ficha?.cargo ?? pessoa.role_title },
        periodo: { inicio, fim },
        jornada: { semanais, dias_semana: diasSemana, esperado_dia: hm(esperadoDia) },
        dias, resumo,
      });
    }

    // --- PDF ---
    const { data: empresa } = await db.from("companies")
      .select("razao_social, cnpj").eq("restaurant_id", restaurantId).eq("ativa", true).maybeSingle();

    const linhas = dias.map((d) => [
      d.rotulo, d.e1, d.s1, d.e2, d.s2,
      d.intervalo, d.trabalhado, d.extra, d.debito, d.noturno, d.observacao,
    ]);
    linhas.push(["TOTAIS", "", "", "", "",
      resumo.intervalo, resumo.trabalhado, resumo.extras, resumo.debito, resumo.noturno, ""]);

    const br = (d: string) => d.split("-").reverse().join("/");

    const blocos: Bloco[] = [
      { tipo: "titulo", texto: "Folha de Ponto" },
      { tipo: "campos", itens: [
        { rotulo: "Colaborador", valor: `${pessoa.full_name}${ficha?.cargo ? " — " + ficha.cargo : ""}` },
        { rotulo: "CPF", valor: ficha?.cpf ?? "—" },
        { rotulo: "Empregador", valor: `${empresa?.razao_social ?? ""} — CNPJ ${empresa?.cnpj ?? ""}` },
        { rotulo: "Período", valor: `${br(inicio)} a ${br(fim)}` },
        { rotulo: "Jornada contratada", valor: `${semanais}h semanais em ${diasSemana} dias — ${hm(esperadoDia)} por dia` },
      ] },
      { tipo: "tabela",
        colunas: [
          { titulo: "Data", largura: 13 },
          { titulo: "1ª Ent.", largura: 6, alinhar: "centro" },
          { titulo: "1ª Saí.", largura: 6, alinhar: "centro" },
          { titulo: "2ª Ent.", largura: 6, alinhar: "centro" },
          { titulo: "2ª Saí.", largura: 6, alinhar: "centro" },
          { titulo: "Interv.", largura: 6, alinhar: "dir" },
          { titulo: "Trabalhado", largura: 8, alinhar: "dir" },
          { titulo: "Extras", largura: 6, alinhar: "dir" },
          { titulo: "Débito", largura: 6, alinhar: "dir" },
          { titulo: "Noturno", largura: 7, alinhar: "dir" },
          { titulo: "Observação", largura: 20 },
        ],
        linhas, destacar: [linhas.length - 1] },
      { tipo: "paragrafo", texto:
        `Hora extra apurada com adicional de ${resumo.he_percentual}% e adicional noturno de ` +
        `${resumo.noturno_percentual}% sobre o trabalho após ${noturnoInicio}. ` +
        (reduzida
          ? `Com a hora noturna reduzida do art. 73 § 1º da CLT, ${resumo.noturno} de relógio equivalem a ${resumo.noturno_reduzido} para pagamento. `
          : "") +
        `Tolerância de ${tolDia} minutos por dia, conforme art. 58 § 1º da CLT.` +
        (resumo.convencao ? ` Base: ${resumo.convencao}.` : "") },
      { tipo: "paragrafo", texto:
        "Marcações com a observação “tem correção” foram ajustadas pela gestão; a marcação " +
        "original permanece guardada no sistema, com autor e motivo." },
      { tipo: "espaco", altura: 10 },
      { tipo: "assinatura", quem: "Colaborador(a)", nome: pessoa.full_name },
      { tipo: "assinatura", quem: "Empregador", nome: empresa?.razao_social ?? "" },
    ];

    const bytes = await gerarPdf({
      titulo: `Folha de Ponto — ${pessoa.full_name}`,
      blocos, paisagem: true,
      rodape: `${empresa?.razao_social ?? ""}  ·  gerado pelo Portal Feitoria`,
    });

    const digest = await sha256(bytes);
    const caminho = `${restaurantId}/${pessoa.id}/${Date.now()}-folha-ponto-${inicio}.pdf`;
    const { error: erroUpload } = await db.storage.from("documentos")
      .upload(caminho, bytes, { contentType: "application/pdf", upsert: false });
    if (erroUpload) return json({ error: "Nao foi possivel guardar o PDF." }, 500);

    const { data: doc, error } = await db.from("documents").insert({
      restaurant_id: restaurantId, employee_id: pessoa.id,
      tipo: "folha_ponto",
      titulo: `Folha de ponto — ${br(inicio)} a ${br(fim)}`,
      competencia: inicio.slice(0, 7),
      storage_path: caminho, sha256: digest, mime: "application/pdf",
      tamanho_bytes: bytes.length,
      origem: "sistema", visibilidade: "colaborador",
      exige_assinatura: true, criado_por: autor.userId,
      data_documento: fim,
      dados_usados: { periodo: { inicio, fim }, resumo, jornada: { semanais, diasSemana } },
    }).select("id, sha256").single();

    if (error) {
      await db.storage.from("documentos").remove([caminho]);
      return json({ error: "Nao foi possivel registrar a folha: " + error.message }, 500);
    }

    return json({ ok: true, id: doc.id, sha256_curto: doc.sha256.slice(0, 12), resumo });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});
