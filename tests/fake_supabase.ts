// Servidor falso que imita o PostgREST no que este projeto usa:
// leitura da tabela de tokens e as tres funcoes de rotacao.
// Reproduz a semantica do UPDATE condicional: so um caller ganha a concessao.

export type Row = {
  credential_key: string;
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  scopes: string[];
  renewing_until: string | null;
  last_rotated_at: string | null;
  rotation_count: number;
  last_error: string | null;
};

export function novaLinha(key: string, over: Partial<Row> = {}): Row {
  return {
    credential_key: key,
    access_token: null,
    access_expires_at: null,
    refresh_token: null,
    refresh_expires_at: null,
    scopes: [],
    renewing_until: null,
    last_rotated_at: null,
    rotation_count: 0,
    last_error: null,
    ...over,
  };
}

export function fakeSupabase(linhas: Map<string, Row>) {
  const handler = (req: Request): Response => {
    const url = new URL(req.url);
    const json = (b: unknown, s = 200) =>
      new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

    // rpc
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.split("/").pop()!;
      return req.json().then((body) => rpc(fn, body, linhas, json)) as unknown as Response;
    }

    // select
    if (url.pathname === "/rest/v1/takeat_oauth_tokens") {
      const eq = url.searchParams.get("credential_key") ?? "";
      const key = eq.replace(/^eq\./, "");
      const row = linhas.get(key);
      return json(row ? [row] : []);
    }
    return json({ message: "rota falsa nao implementada: " + url.pathname }, 404);
  };

  // O handler precisa ser async por causa do rpc.
  return async (req: Request): Promise<Response> => await handler(req);
}

function rpc(
  fn: string,
  body: Record<string, unknown>,
  linhas: Map<string, Row>,
  json: (b: unknown, s?: number) => Response,
): Response {
  const key = String(body.p_credential_key);
  const row = linhas.get(key);
  const agora = Date.now();

  if (fn === "takeat_begin_rotation") {
    // UPDATE ... WHERE renewing_until IS NULL OR renewing_until < now() RETURNING ...
    if (!row) return json([]);
    const livre = !row.renewing_until || Date.parse(row.renewing_until) < agora;
    if (!livre) return json([]);
    row.renewing_until = new Date(agora + Number(body.p_lease_seconds ?? 30) * 1000).toISOString();
    return json([{
      refresh_token: row.refresh_token,
      access_token: row.access_token,
      access_expires_at: row.access_expires_at,
    }]);
  }

  if (fn === "takeat_commit_rotation") {
    const atual = row ?? novaLinha(key);
    atual.access_token = String(body.p_access_token);
    atual.access_expires_at = String(body.p_access_expires_at);
    atual.refresh_token = (body.p_refresh_token as string | null) ?? null;
    atual.refresh_expires_at = (body.p_refresh_expires_at as string | null) ?? null;
    atual.scopes = (body.p_scopes as string[]) ?? [];
    atual.renewing_until = null;
    atual.last_rotated_at = new Date(agora).toISOString();
    atual.rotation_count += 1;
    atual.last_error = null;
    linhas.set(key, atual);
    return json(null);
  }

  if (fn === "takeat_fail_rotation") {
    if (row) {
      row.renewing_until = null;
      row.last_error = String(body.p_error_code);
      if (body.p_error_code === "invalid_grant") {
        row.refresh_token = null;
        row.access_token = null;
      }
    }
    return json(null);
  }

  if (fn === "takeat_release_rotation") {
    if (row) row.renewing_until = null;
    return json(null);
  }

  return json({ message: "funcao falsa nao implementada: " + fn }, 404);
}
