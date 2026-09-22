-- Tokens OAuth da Takeat (Nova API V1.0)
-- Fonte: https://docs.takeat.app/md/v1/api-key-tokens.md
--
-- O refresh token e rotativo e de USO UNICO: reusar um refresh ja consumido
-- revoga a familia inteira de tokens. Por isso a renovacao precisa ser
-- atomica e jamais concorrente.
--
-- A trava e por CONCESSAO (lease), nao por advisory lock: uma Edge Function
-- nao controla os limites da transacao, entao um pg_advisory_xact_lock
-- soltaria no fim da propria chamada e nao protegeria nada. Aqui quem renova
-- e quem consegue marcar a linha com um UPDATE condicional -- uma operacao
-- atomica por natureza. Quem nao conseguir, espera e le o token novo.
--
-- Nada aqui e legivel pelo navegador: RLS ligada e sem policy nenhuma.
-- Apenas a service_role (Edge Functions) enxerga a tabela.

create table if not exists public.takeat_oauth_tokens (
  credential_key      text primary key,              -- nome logico da credencial, ex.: 'pub_mogi'
  access_token        text,
  access_expires_at   timestamptz,
  refresh_token       text,
  refresh_expires_at  timestamptz,
  scopes              text[]      not null default '{}',
  renewing_until      timestamptz,                    -- concessao de renovacao em curso
  last_rotated_at     timestamptz,
  rotation_count      bigint      not null default 0,
  last_error          text,                           -- codigo do erro, nunca o valor do token
  last_error_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.takeat_oauth_tokens is
  'Tokens OAuth da Takeat. Escrita exclusiva das Edge Functions (service_role). Nunca exposta ao cliente.';
comment on column public.takeat_oauth_tokens.renewing_until is
  'Ate quando a concessao de renovacao vale. Nula quando ninguem esta renovando.';
comment on column public.takeat_oauth_tokens.last_error is
  'Somente o codigo do erro (invalid_grant, invalid_client, rate_limited). Nunca o token.';

alter table public.takeat_oauth_tokens enable row level security;
-- Sem policies de proposito: anon e authenticated nao acessam.

revoke all on public.takeat_oauth_tokens from anon, authenticated;

create or replace function public.touch_takeat_oauth_tokens()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_takeat_oauth_tokens on public.takeat_oauth_tokens;
create trigger trg_touch_takeat_oauth_tokens
  before update on public.takeat_oauth_tokens
  for each row execute function public.touch_takeat_oauth_tokens();


-- Tenta assumir a renovacao. Devolve uma linha (com o refresh token a usar)
-- apenas para quem conseguiu a concessao; para todos os outros, nada.
-- Uma concessao vencida e reaproveitada: se a function anterior morreu no
-- meio, a credencial nao fica travada para sempre.
create or replace function public.takeat_begin_rotation(
  p_credential_key text,
  p_lease_seconds  integer default 30
)
returns table (refresh_token text, access_token text, access_expires_at timestamptz)
language sql
security definer
set search_path = public
as $$
  update public.takeat_oauth_tokens t
     set renewing_until = now() + make_interval(secs => p_lease_seconds)
   where t.credential_key = p_credential_key
     and (t.renewing_until is null or t.renewing_until < now())
  returning t.refresh_token, t.access_token, t.access_expires_at;
$$;


-- Fecha a renovacao gravando o par novo e liberando a concessao.
create or replace function public.takeat_commit_rotation(
  p_credential_key     text,
  p_access_token       text,
  p_access_expires_at  timestamptz,
  p_refresh_token      text,
  p_refresh_expires_at timestamptz,
  p_scopes             text[]
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.takeat_oauth_tokens as t (
    credential_key, access_token, access_expires_at,
    refresh_token, refresh_expires_at, scopes,
    renewing_until, last_rotated_at, rotation_count, last_error, last_error_at
  )
  values (
    p_credential_key, p_access_token, p_access_expires_at,
    p_refresh_token, p_refresh_expires_at, coalesce(p_scopes, '{}'),
    null, now(), 1, null, null
  )
  on conflict (credential_key) do update
     set access_token       = excluded.access_token,
         access_expires_at  = excluded.access_expires_at,
         refresh_token      = excluded.refresh_token,
         refresh_expires_at = excluded.refresh_expires_at,
         scopes             = excluded.scopes,
         renewing_until     = null,
         last_rotated_at    = now(),
         rotation_count     = t.rotation_count + 1,
         last_error         = null,
         last_error_at      = null;
$$;


-- Libera a concessao registrando o codigo do erro (nunca o token).
-- Em invalid_grant a familia morreu: zera o refresh para forcar uma troca
-- nova a partir da API key, em vez de insistir num token que nao vale mais.
create or replace function public.takeat_fail_rotation(
  p_credential_key text,
  p_error_code     text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.takeat_oauth_tokens
     set renewing_until = null,
         last_error     = p_error_code,
         last_error_at  = now(),
         refresh_token  = case when p_error_code = 'invalid_grant' then null else refresh_token end,
         access_token   = case when p_error_code = 'invalid_grant' then null else access_token end
   where credential_key = p_credential_key;
$$;


revoke execute on function public.takeat_begin_rotation(text, integer)                              from anon, authenticated, public;
revoke execute on function public.takeat_commit_rotation(text, text, timestamptz, text, timestamptz, text[]) from anon, authenticated, public;
revoke execute on function public.takeat_fail_rotation(text, text)                                  from anon, authenticated, public;


-- Libera a concessao sem gravar erro: usado quando o caller pegou a concessao
-- mas descobriu que o token ja estava valido.
create or replace function public.takeat_release_rotation(p_credential_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.takeat_oauth_tokens
     set renewing_until = null
   where credential_key = p_credential_key;
$$;

revoke execute on function public.takeat_release_rotation(text) from anon, authenticated, public;
