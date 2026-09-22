// Verificacoes do ciclo de tokens, sem tocar na API real.
// Tudo aqui usa valores ficticios: nenhuma credencial de verdade.

// assert minimo, para nao depender de rede no sandbox
function assert(cond: unknown, msg = "condicao falsa"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEquals<T>(a: T, b: T, msg?: string) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg ?? `esperado ${sb}, veio ${sa}`);
}
import { fakeSupabase, novaLinha, type Row } from "./fake_supabase.ts";

// Ambiente ficticio, definido antes de importar o modulo (ele le env no topo).
Deno.env.set("TAKEAT_API_KEY", "tk_test_chave_ficticia_para_teste");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service_role_ficticia");
Deno.env.set("TAKEAT_CREDENTIAL_KEY", "pub_mogi");
Deno.env.set("TAKEAT_MIN_INTERVAL_MS", "0");
Deno.env.set("TAKEAT_TIMEOUT_MS", "2000");

const FAKE_TAKEAT = "http://takeat.local";
Deno.env.set("TAKEAT_BASE_URL", FAKE_TAKEAT);
Deno.env.set("SUPABASE_URL", "http://supabase.local");

type Cenario = {
  linhas: Map<string, Row>;
  trocas: Array<Record<string, string>>;
  respostaToken: (body: Record<string, string>, n: number) => Response;
  respostaDados?: (url: URL, n: number) => Response;
  chamadasDados: number;
};

let cenario: Cenario;
const supabaseHandler = () => fakeSupabase(cenario.linhas);

const original = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);

  if (url.origin === "http://supabase.local") return await supabaseHandler()(req);

  if (url.origin === FAKE_TAKEAT && url.pathname === "/oauth/token") {
    const body = Object.fromEntries(new URLSearchParams(await req.text()));
    cenario.trocas.push(body);
    return cenario.respostaToken(body, cenario.trocas.length);
  }

  if (url.origin === FAKE_TAKEAT) {
    cenario.chamadasDados += 1;
    return cenario.respostaDados?.(url, cenario.chamadasDados) ??
      new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return await original(input as Request, init);
};

const tokenOk = (sufixo: string, expiresIn = 900) =>
  new Response(
    JSON.stringify({
      access_token: `access_${sufixo}`,
      refresh_token: `refresh_${sufixo}`,
      expires_in: expiresIn,
      scope: "inputs:read intermediaries:read table-sessions:read",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const erro = (code: string, status = 400) =>
  new Response(JSON.stringify({ error: code }), { status, headers: { "content-type": "application/json" } });

function reset(linhas: Row[] = []) {
  cenario = {
    linhas: new Map(linhas.map((l) => [l.credential_key, l])),
    trocas: [],
    respostaToken: (_b, n) => tokenOk(String(n)),
    chamadasDados: 0,
  };
}

const { getAccessToken, takeatGet, TakeatError } = await import("../supabase/functions/_shared/takeat.ts");

const futuro = (ms: number) => new Date(Date.now() + ms).toISOString();

Deno.test("primeira conexao troca a API key por um par de tokens", async () => {
  reset();
  const token = await getAccessToken();
  assertEquals(token, "access_1");
  assertEquals(cenario.trocas.length, 1);
  assertEquals(cenario.trocas[0].grant_type, "api_key");
  assertEquals(cenario.linhas.get("pub_mogi")?.refresh_token, "refresh_1");
});

Deno.test("token em cache nao gera nova troca", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_guardado",
    access_expires_at: futuro(10 * 60_000),
    refresh_token: "refresh_guardado",
  })]);
  assertEquals(await getAccessToken(), "access_guardado");
  assertEquals(cenario.trocas.length, 0);
});

Deno.test("token perto do vencimento e renovado com folga de 60 s", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_quase_vencido",
    access_expires_at: futuro(30_000), // dentro da margem
    refresh_token: "refresh_guardado",
  })]);
  const token = await getAccessToken();
  assertEquals(token, "access_1");
  assertEquals(cenario.trocas[0].grant_type, "refresh_token");
  assertEquals(cenario.trocas[0].refresh_token, "refresh_guardado");
});

Deno.test("chamadas concorrentes fazem UMA rotacao so", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_vencido",
    access_expires_at: futuro(-1000),
    refresh_token: "refresh_unico",
  })]);
  // A troca demora, para garantir que os concorrentes cheguem durante a renovacao.
  cenario.respostaToken = (_b, n) => tokenOk(String(n));
  const originalToken = cenario.respostaToken;
  cenario.respostaToken = (b, n) => {
    const r = originalToken(b, n);
    return r;
  };

  const tokens = await Promise.all([
    getAccessToken(),
    getAccessToken(),
    getAccessToken(),
    getAccessToken(),
    getAccessToken(),
  ]);

  // Uma unica troca: o refresh de uso unico nunca foi enviado duas vezes.
  assertEquals(cenario.trocas.length, 1, `trocas: ${JSON.stringify(cenario.trocas)}`);
  assertEquals(cenario.trocas[0].refresh_token, "refresh_unico");
  assert(tokens.every((t) => t === "access_1"), `tokens: ${tokens.join(", ")}`);
});

Deno.test("invalid_grant recomeca pela API key em vez de insistir no refresh", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_vencido",
    access_expires_at: futuro(-1000),
    refresh_token: "refresh_morto",
  })]);
  cenario.respostaToken = (body, n) =>
    body.grant_type === "refresh_token" ? erro("invalid_grant") : tokenOk(String(n));

  const token = await getAccessToken();
  assertEquals(cenario.trocas.length, 2);
  assertEquals(cenario.trocas[0].grant_type, "refresh_token");
  assertEquals(cenario.trocas[1].grant_type, "api_key");
  assertEquals(token, "access_2");
});

Deno.test("invalid_client nao vira retentativa cega", async () => {
  reset();
  cenario.respostaToken = () => erro("invalid_client", 401);
  await getAccessToken()
    .then(() => { throw new Error("deveria ter falhado"); })
    .catch((err) => {
      assert(err instanceof TakeatError);
      assertEquals((err as InstanceType<typeof TakeatError>).code, "invalid_client");
    });
  assertEquals(cenario.trocas.length, 1);
});

Deno.test("429 numa rota de dados respeita Retry-After e tenta de novo", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_valido",
    access_expires_at: futuro(10 * 60_000),
    refresh_token: "refresh_valido",
  })]);
  cenario.respostaDados = (_url, n) =>
    n === 1
      ? new Response("{}", { status: 429, headers: { "retry-after": "0" } })
      : new Response(JSON.stringify({ total: 1, remaining: 0, inputs: [{ name: "Queijo" }] }), { status: 200 });

  const body = await takeatGet<{ inputs: Array<{ name: string }> }>("/v1/inputs");
  assertEquals(cenario.chamadasDados, 2);
  assertEquals(body.inputs[0].name, "Queijo");
});

Deno.test("401 numa rota de dados forca UMA renovacao e repete a chamada", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_revogado",
    access_expires_at: futuro(10 * 60_000),
    refresh_token: "refresh_valido",
  })]);
  cenario.respostaDados = (_url, n) =>
    n === 1
      ? new Response("{}", { status: 401 })
      : new Response(JSON.stringify({ total: 0, remaining: 0, inputs: [] }), { status: 200 });

  await takeatGet("/v1/inputs");
  assertEquals(cenario.chamadasDados, 2);
  assertEquals(cenario.trocas.length, 1);
  assertEquals(cenario.trocas[0].grant_type, "refresh_token");
});

Deno.test("403 nao repete: escopo faltando nao melhora com tentativa", async () => {
  reset([novaLinha("pub_mogi", {
    access_token: "access_valido",
    access_expires_at: futuro(10 * 60_000),
    refresh_token: "refresh_valido",
  })]);
  cenario.respostaDados = () => new Response("{}", { status: 403 });

  await takeatGet("/v1/financial/cash-flows")
    .then(() => { throw new Error("deveria ter falhado"); })
    .catch((err) => assertEquals((err as InstanceType<typeof TakeatError>).code, "forbidden"));
  assertEquals(cenario.chamadasDados, 1);
});
