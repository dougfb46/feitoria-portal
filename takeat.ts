// Cliente da Nova API V1.0 da Takeat.
//
// Contratos usados (fonte da verdade):
//   https://docs.takeat.app/md/v1/autenticacao.md
//   https://docs.takeat.app/md/v1/api-key-tokens.md
//
// Regras que este modulo garante:
//   - a API key so existe aqui dentro, vinda do segredo TAKEAT_API_KEY;
//   - o access token vale 900 s e e renovado com 60 s de folga;
//   - o refresh e de uso unico: a rotacao e serializada por concessao no banco;
//   - 429 respeita Retry-After; falhas repetiveis usam backoff com jitter;
//   - nenhum valor de token, chave ou header Authorization vai para o log.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BASE_URL = Deno.env.get("TAKEAT_BASE_URL") ?? "https://public-api.takeat.app";
const CREDENTIAL_KEY = Deno.env.get("TAKEAT_CREDENTIAL_KEY") ?? "pub_mogi";

/** Folga antes de considerar o access token vencido. */
const EXPIRY_MARGIN_MS = 60_000;
/** Duracao da concessao de renovacao. */
const LEASE_SECONDS = 30;
/** Quanto esperar pelo token de quem esta renovando, antes de desistir. */
const WAIT_FOR_PEER_MS = 12_000;
const WAIT_POLL_MS = 400;
/**
 * Teto publicado: 10 requisicoes por minuto (docs/v1/autenticacao.md).
 * 6,5 s entre chamadas deixam margem. Ajustavel por TAKEAT_MIN_INTERVAL_MS
 * caso a chave de producao tenha limite diferente -- a doc nao informa.
 */
const MIN_INTERVAL_MS = Number(Deno.env.get("TAKEAT_MIN_INTERVAL_MS") ?? 6_500);
const REQUEST_TIMEOUT_MS = Number(Deno.env.get("TAKEAT_TIMEOUT_MS") ?? 20_000);
const MAX_ATTEMPTS = 3;

export class TakeatError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "TakeatError";
  }
}

function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new TakeatError("missing_config", 500, "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function apiKey(): string {
  const key = Deno.env.get("TAKEAT_API_KEY");
  if (!key) {
    throw new TakeatError("missing_config", 500, "TAKEAT_API_KEY ausente no ambiente");
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espacamento entre chamadas dentro deste isolate, para nao estourar o teto por minuto. */
let nextSlot = 0;
async function rateLimitSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

type TokenRow = {
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  refresh_token_expires_in?: number;
};

function stillValid(row: Pick<TokenRow, "access_token" | "access_expires_at">): string | null {
  if (!row.access_token || !row.access_expires_at) return null;
  const expiresAt = Date.parse(row.access_expires_at);
  if (Number.isNaN(expiresAt)) return null;
  return expiresAt - EXPIRY_MARGIN_MS > Date.now() ? row.access_token : null;
}

/**
 * Troca no /oauth/token. Nao ha retentativa automatica aqui: um refresh de uso
 * unico pode ter sido consumido mesmo quando a resposta nao chega, e insistir
 * derruba a familia inteira. Quem chama decide o que fazer com o erro.
 */
async function exchange(body: Record<string, string>): Promise<TokenResponse> {
  await rateLimitSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      // O corpo de erro do /oauth/token nao carrega segredo, so o codigo.
      let code = "http_error";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") code = data.error;
      } catch { /* resposta sem JSON */ }
      throw new TakeatError(code, res.status, `Falha na troca de token (${res.status}: ${code})`, res.status === 429);
    }

    const data = await res.json() as TokenResponse;
    if (!data?.access_token || !data?.expires_in) {
      throw new TakeatError("invalid_response", 502, "Resposta do /oauth/token sem access_token ou expires_in");
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function persist(db: SupabaseClient, requestStartedAt: number, data: TokenResponse): Promise<string> {
  // Conforme o guia: expiresAt = requestStartedAt + expires_in * 1000.
  const accessExpiresAt = new Date(requestStartedAt + data.expires_in * 1000).toISOString();
  const refreshExpiresAt = data.refresh_token_expires_in
    ? new Date(requestStartedAt + data.refresh_token_expires_in * 1000).toISOString()
    : null;

  const { error } = await db.rpc("takeat_commit_rotation", {
    p_credential_key: CREDENTIAL_KEY,
    p_access_token: data.access_token,
    p_access_expires_at: accessExpiresAt,
    p_refresh_token: data.refresh_token ?? null,
    p_refresh_expires_at: refreshExpiresAt,
    p_scopes: data.scope ? data.scope.split(/\s+/).filter(Boolean) : [],
  });
  if (error) throw new TakeatError("persist_failed", 500, `Nao foi possivel gravar os tokens: ${error.message}`);
  return data.access_token;
}

/** Espera quem esta renovando terminar e devolve o token novo, se aparecer. */
async function waitForPeer(db: SupabaseClient): Promise<string | null> {
  const deadline = Date.now() + WAIT_FOR_PEER_MS;
  while (Date.now() < deadline) {
    await sleep(WAIT_POLL_MS);
    const { data } = await db
      .from("takeat_oauth_tokens")
      .select("access_token, access_expires_at")
      .eq("credential_key", CREDENTIAL_KEY)
      .maybeSingle();
    if (data) {
      const token = stillValid(data as TokenRow);
      if (token) return token;
    }
  }
  return null;
}

/**
 * Devolve um access token valido, renovando se preciso.
 * `force` descarta o token em cache (usado depois de um 401).
 */
export async function getAccessToken(force = false): Promise<string> {
  const db = admin();

  if (!force) {
    const { data } = await db
      .from("takeat_oauth_tokens")
      .select("access_token, access_expires_at")
      .eq("credential_key", CREDENTIAL_KEY)
      .maybeSingle();
    if (data) {
      const token = stillValid(data as TokenRow);
      if (token) return token;
    }
  }

  // Tenta assumir a renovacao. Só um caller consegue a concessao.
  const { data: claimed, error: claimError } = await db.rpc("takeat_begin_rotation", {
    p_credential_key: CREDENTIAL_KEY,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (claimError) {
    throw new TakeatError("lease_failed", 500, `Falha ao assumir a renovacao: ${claimError.message}`);
  }

  const lease = Array.isArray(claimed) ? claimed[0] as TokenRow | undefined : undefined;

  if (!lease) {
    // Sem concessao por um de dois motivos: ou outro processo esta renovando,
    // ou a credencial ainda nao existe na tabela. Distinguir antes de esperar --
    // esperar por um par que nao existe custaria 12 s na primeira conexao.
    const { data: exists } = await db
      .from("takeat_oauth_tokens")
      .select("credential_key")
      .eq("credential_key", CREDENTIAL_KEY)
      .maybeSingle();

    if (!exists) {
      // Primeira vez: troca a API key por um par novo.
      const startedAt = Date.now();
      const data = await exchange({ grant_type: "api_key", api_key: apiKey() });
      return await persist(db, startedAt, data);
    }

    const peerToken = await waitForPeer(db);
    if (peerToken) return peerToken;
    throw new TakeatError("rotation_busy", 503, "Outra renovacao em curso demorou demais", true);
  }

  // Com a concessao em maos: o token pode ter sido renovado entre a leitura e o claim.
  if (!force) {
    const fresh = stillValid(lease);
    if (fresh) {
      await db.rpc("takeat_release_rotation", { p_credential_key: CREDENTIAL_KEY });
      return fresh;
    }
  }

  const startedAt = Date.now();
  try {
    const data = lease.refresh_token
      ? await exchange({ grant_type: "refresh_token", refresh_token: lease.refresh_token })
      : await exchange({ grant_type: "api_key", api_key: apiKey() });
    return await persist(db, startedAt, data);
  } catch (err) {
    const code = err instanceof TakeatError ? err.code : "unknown";
    await db.rpc("takeat_fail_rotation", { p_credential_key: CREDENTIAL_KEY, p_error_code: code });

    // invalid_grant: a familia de refresh morreu. Nao insistir no refresh --
    // recomecar pela API key e o unico caminho correto.
    if (code === "invalid_grant" && lease.refresh_token) {
      const retryStartedAt = Date.now();
      const data = await exchange({ grant_type: "api_key", api_key: apiKey() });
      return await persist(db, retryStartedAt, data);
    }
    throw err;
  }
}

/** GET autenticado em /v1/*. Devolve o JSON ja tipado por quem chama. */
export async function takeatGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let token = await getAccessToken();
  let retriedAuth = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await rateLimitSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      if (attempt === MAX_ATTEMPTS) {
        throw new TakeatError("network_error", 0, `Falha de rede em ${path}`, true);
      }
      await sleep(backoff(attempt));
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) return await res.json() as T;

    // 401: token pode ter sido revogado. Uma unica renovacao forcada.
    if (res.status === 401 && !retriedAuth) {
      retriedAuth = true;
      token = await getAccessToken(true);
      continue;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      if (attempt === MAX_ATTEMPTS) {
        throw new TakeatError("rate_limited", 429, `Limite de requisicoes atingido em ${path}`, true);
      }
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }

    if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
      await sleep(backoff(attempt));
      continue;
    }

    throw new TakeatError(
      res.status === 403 ? "forbidden" : res.status === 400 ? "bad_request" : "http_error",
      res.status,
      `${path} respondeu ${res.status}`,
    );
  }

  throw new TakeatError("exhausted", 0, `Tentativas esgotadas em ${path}`, true);
}

/** Backoff exponencial com jitter: 1s, 2s, 4s... mais ate 400 ms de folga. */
function backoff(attempt: number): number {
  return 2 ** (attempt - 1) * 1000 + Math.random() * 400;
}

/** Percorre um endpoint paginado de 100 em 100 ate `remaining` zerar. */
export async function takeatGetAll<T>(
  path: string,
  listKey: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (let page = 0; page < 200; page++) {
    const body = await takeatGet<Record<string, unknown>>(path, { ...params, offset });
    const items = (body[listKey] ?? []) as T[];
    out.push(...items);
    const remaining = Number(body.remaining ?? 0);
    if (!items.length || remaining <= 0) break;
    offset += items.length;
  }
  return out;
}

export const takeatConfig = {
  baseUrl: BASE_URL,
  credentialKey: CREDENTIAL_KEY,
  hasApiKey: () => Boolean(Deno.env.get("TAKEAT_API_KEY")),
};
