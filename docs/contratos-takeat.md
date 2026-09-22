# Contratos da Takeat consultados

Lidos em 22/09/2026 em `docs.takeat.app`. São a fonte da verdade deste projeto:
nada aqui foi inferido.

| Página | O que sustenta |
|---|---|
| `/md/v1/primeiros-passos.md` | escolha entre API Key e OAuth; chave gerada no AI Builders; base `https://public-api.takeat.app` |
| `/md/v1/autenticacao.md` | lista de escopos; ambientes `tk_test_`/`tk_live_`; limites de 10/min e 500/dia |
| `/md/v1/api-key-tokens.md` | `/oauth/token` form-urlencoded; access de 900 s; refresh rotativo de uso único; `expiresAt = requestStartedAt + expires_in * 1000`; margem de 60 s; erros 400/401/403/429 |
| `/md/v1/estoque.md` e `/md/v1/referencia/estoque/getInputsV1.md`, `getIntermediariesV1.md` | `/v1/inputs` e `/v1/intermediaries`: página fixa de 100, `offset`, campos da resposta |
| `/md/v1/financeiro.md` | `/v1/financial/cash-flows`: janela máxima de 92 dias, `date_type`, bloco `totals` |
| `/md/v1/referencia/pedidos/getTableSessionsV1.md` | `/v1/table-sessions`: janela máxima de 3 dias + fração, datas em UTC, `bills`/`payments`/`nfce` |
| `/md/v1/referencia/cardapio/getMenu.md` | `/v1/menu`: `channel`, `pricing.resolved.base` e `.minimum` |

## Escopos

`menu:read`, `products:read/write`, `complements:read/write`, `table-sessions:read`,
`payment-methods:read`, `financial:read`, `brands:read`, `nfe-received:read`,
`inputs:read`, `intermediaries:read`, `clube:read`.

Este projeto pede apenas leitura. Nenhuma operação de escrita na Takeat é usada.

## O que não foi possível confirmar

1. **Identificador de insumo e intermediário.** Os contratos `.md` listam `name`,
   `unidade`, `quantidade`, `total_value`, `unitary_price`, `ideal_stock`,
   `minimum_stock` (mais `is_master` e `cash_flow_category_subcategory` em inputs)
   — **sem campo `id`**. O `openapi-v1.yaml` aponta para um `openapi.yaml` externo
   que não abriu. Enquanto isso, o vínculo da etiqueta é por **nome**.
2. **Webhooks**: não há nenhum publicado. Tudo é consulta.
3. **Escrita de perdas, sobras, inventário ou contagem**: nenhum endpoint publicado.
4. **Limites da chave de produção**: a documentação dá 10/min e 500/dia como
   referência e não diz se `tk_live_` tem teto diferente.

## Decisões que vieram disso

- O espaçamento entre chamadas é de 6,5 s por padrão, configurável, porque o teto
  publicado é por minuto.
- A carga histórica de comandas (24 meses) são ~244 chamadas em janelas de 3 dias:
  cabe no teto diário de 500, mas leva ~25 min. Vai como job com retomada por
  cursor, não como botão de tela.
- O dia operacional do PUB fecha às **01:00** (America/Sao_Paulo). A API entrega
  UTC; a data de negócio é coluna derivada, calculada no servidor.
