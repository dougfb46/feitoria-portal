// Diagnostico da conexao com a Takeat.
//
// Responde SOMENTE estado: nomes de variaveis ausentes, escopos concedidos,
// quando o access token vence. Nunca o valor de chave, token ou header.
//
// Uso: GET /functions/v1/takeat-auth-status  (verify_jwt ON -- so usuario logado)

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAccessToken, takeatConfig, TakeatError } from "../_shared/takeat.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ erro: "metodo_nao_suportado" }, 405);
  }

  // 1. Variaveis de ambiente: so o nome, nunca o valor.
  const obrigatorias = ["TAKEAT_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const ausentes = obrigatorias.filter((nome) => !Deno.env.get(nome));

  if (ausentes.length) {
    return json({
      conexao: "nao_configurada",
      variaveis_ausentes: ausentes,
      o_que_fazer: "Cadastrar esses segredos no painel do Supabase, em Edge Functions > Secrets.",
    }, 428);
  }

  // 2. Formato da chave, sem revelar conteudo.
  const chave = Deno.env.get("TAKEAT_API_KEY")!;
  const ambiente = chave.startsWith("tk_live_")
    ? "producao"
    : chave.startsWith("tk_test_")
    ? "teste"
    : "desconhecido";

  if (ambiente === "desconhecido") {
    return json({
      conexao: "chave_com_formato_inesperado",
      detalhe: "A chave nao comeca com tk_live_ nem tk_test_.",
      o_que_fazer: "Conferir o valor copiado do AI Builders e cadastrar de novo.",
    }, 428);
  }

  // 3. Troca de verdade, para saber se a credencial funciona.
  try {
    await getAccessToken();
  } catch (err) {
    const code = err instanceof TakeatError ? err.code : "erro_desconhecido";
    return json({
      conexao: "falhou",
      ambiente,
      codigo: code,
      o_que_significa: explicar(code),
    }, 502);
  }

  // 4. Estado gravado: escopos e vencimento, sem tokens.
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data } = await db
    .from("takeat_oauth_tokens")
    .select("scopes, access_expires_at, last_rotated_at, rotation_count")
    .eq("credential_key", takeatConfig.credentialKey)
    .maybeSingle();

  return json({
    conexao: "ok",
    ambiente,
    credencial: takeatConfig.credentialKey,
    base_url: takeatConfig.baseUrl,
    escopos_concedidos: data?.scopes ?? [],
    access_token_vence_em: data?.access_expires_at ?? null,
    ultima_renovacao: data?.last_rotated_at ?? null,
    renovacoes: data?.rotation_count ?? 0,
  });
});

function explicar(code: string): string {
  switch (code) {
    case "invalid_client":
      return "A chave nao foi aceita. Pode ter sido revogada ou copiada pela metade.";
    case "invalid_grant":
      return "O refresh token nao vale mais. A proxima chamada recomeca pela API key.";
    case "rate_limited":
      return "Limite de requisicoes atingido. Esperar e tentar de novo.";
    case "missing_config":
      return "Falta uma variavel de ambiente no projeto.";
    case "rotation_busy":
      return "Outra renovacao estava em curso e demorou. Tentar de novo.";
    default:
      return "Falha ao falar com a Takeat.";
  }
}
