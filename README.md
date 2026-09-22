# Feitoria Portal

Portal de gestão do PUB Mogi (Feitoria da Cerveja). Integra a **Nova API V1.0 da Takeat**
para trazer catálogo, vendas e financeiro para dentro do portal.

A tela da cozinha (etiquetas) continua no repositório
[`feitoria-etiquetas`](https://github.com/dougfb46/feitoria-etiquetas) e não foi movida.

## Como as peças se encaixam

```
Navegador  ──►  Edge Function (Supabase)  ──►  API da Takeat
(sem chave)      (guarda a chave)               public-api.takeat.app
                        │
                        ▼
                 Postgres (Supabase)
```

A chave da Takeat **nunca** chega ao navegador. O front só fala com o Supabase;
quem fala com a Takeat é a Edge Function.

Páginas HTML moram no GitHub Pages: o gateway de Edge Functions deste projeto
descarta o `content-type` e serviria HTML como texto cru.

## Estrutura

```
supabase/migrations/   SQL aplicado no banco
supabase/functions/    Edge Functions (Deno)
  _shared/takeat.ts    cliente da API: tokens, rotação, limites, erros
  takeat-auth-status/  diagnóstico da conexão
tests/                 verificações com dados fictícios, sem tocar na API real
web/                   páginas do portal (GitHub Pages)
docs/                  decisões e contratos consultados
```

## Configuração

Os segredos ficam no painel do Supabase (**Edge Functions › Secrets**), nunca no
repositório. O arquivo `.env.example` lista os nomes com valores fictícios.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `TAKEAT_API_KEY` | sim | Chave gerada em [ai-builders.takeat.app](https://ai-builders.takeat.app). `tk_test_` ou `tk_live_` |
| `TAKEAT_CREDENTIAL_KEY` | tem padrão (`pub_mogi`) | Nome da credencial no banco; isola tokens se um dia houver mais de uma |
| `TAKEAT_BASE_URL` | não | Padrão `https://public-api.takeat.app` |
| `TAKEAT_MIN_INTERVAL_MS` | não | Espaçamento entre chamadas. Padrão 6500 (teto publicado: 10/min) |
| `TAKEAT_TIMEOUT_MS` | não | Timeout por chamada. Padrão 20000 |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas pelo próprio Supabase.

### Conferir se funcionou

Depois de cadastrar a chave, chame a função de diagnóstico:

```
GET https://<projeto>.supabase.co/functions/v1/takeat-auth-status
```

Ela responde só o estado — escopos concedidos, quando o token vence, qual
variável está faltando. Nunca imprime chave nem token.

## Verificações locais

Precisa do [Deno](https://deno.com).

```bash
deno task check   # checagem de tipos
deno task test    # 9 verificações do ciclo de tokens, com dados fictícios
```

Os testes **não** falam com a Takeat: sobem um servidor falso. Passar nos testes
não quer dizer que a integração está validada contra a API real — isso só a
função de diagnóstico, com a chave cadastrada, responde.

## Ciclo de tokens, em uma frase

A API key é trocada uma vez por um par access + refresh; o access vale 900 s e é
renovado com 60 s de folga; o refresh é de **uso único** e a renovação é
serializada por uma concessão no banco, porque reusar um refresh já consumido
revoga a família inteira de tokens.

Contratos consultados: `docs/contratos-takeat.md`.
