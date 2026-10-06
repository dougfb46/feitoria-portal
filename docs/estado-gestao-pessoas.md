
# Atualização — 24/09/2026: módulo de Gestão de Pessoas

_O texto acima descreve a fase das etiquetas, em setembro. O portal seguiu por outro caminho: o frontend não foi feito no Lovable (economia de créditos), e sim em páginas HTML estáticas no GitHub Pages do repositório `dougfb46/feitoria-portal`, falando só com Edge Functions._

## Páginas

- **`ponto.html`** — totem do tablet fixo. PIN, foto pela câmera, sequência travada: entrada → saída para intervalo → volta do intervalo → saída. Um botão habilitado por vez.
- **`gestao.html`** — tela do gestor. Abas Equipe, Ponto do dia, Documentos e **Folha de ponto**.
- **`portal.html`** — portal do colaborador no celular. PIN + data de nascimento + vínculo com o aparelho. Lista documentos e assina reinserindo o PIN.

## Edge Functions

`ponto`, `portal`, `gestao-equipe`, `gestao-documentos`, `gestao-gerar`, `gestao-modelos`, `gestao-folha`, além de `etiqueta`, `takeat-auth-status` e `takeat-sync-catalogo`.
A função temporária `takeat-probe` deve ser apagada.

## Desenho que não se mexe

- **`time_entries` é append-only**: triggers bloqueiam UPDATE e DELETE, e cada linha carrega hash encadeado (SHA-256) da anterior. Correção é linha nova apontando para a original, com autor e motivo. A folha ignora a marcação substituída; o histórico fica para prova.
- **Sem reconhecimento facial.** A foto é só evidência — evita a categoria de biometria sensível da LGPD.
- **Nada de percentual chumbado no código.** Hora extra, adicional noturno, horário de início do noturno, hora noturna reduzida e tolerância vivem em `payroll_settings`, com vigência. Salvar cria vigência nova; folha já gerada não é reescrita.

## Folha de ponto (`gestao-folha`)

Ações `parametros`, `salvar_parametros`, `folha` e `folha_pdf`. Por colaborador e por dia operacional apura as quatro marcações, intervalo, horas trabalhadas, crédito e débito depois da tolerância (art. 58 § 1º da CLT) e minutos noturnos. A jornada esperada vem de `employee_records.jornada_semanal_horas` / `dias_por_semana` — 44h em 6 dias dá 7h20 por dia, batendo com a coluna "Horas normais" do relatório da Pontomais.

O PDF sai em paisagem, com texto selecionável, tabela com cabeçalho repetido a cada página e linha de totais; é gravado no bucket `documentos` com SHA-256 e publicado em `documents` para o colaborador assinar no portal.

## Parâmetros ainda NÃO confirmados

Semeados como 50% de hora extra, 60% na segunda faixa e 20% de adicional noturno, marcados como não confirmados. A tela avisa enquanto a contabilidade não responder sobre o enquadramento sindical — a Feitoria vinha sendo tratada por outro sindicato e o SINTHORESP notificou.

## Pendências

- Apagar `takeat-probe`.
- Limpar os dados de teste (`Teste Cozinha` e suas marcações) antes de entrar em produção — reset deliberado, já que a tabela é append-only.
- Falta a ficha da Valéria (4ª pessoa que bate ponto).
- Minuta de LGPD aguarda revisão da contabilidade/advogado.
- Fases seguintes: vendas e caixa da Takeat (24 meses, janelas de 3 dias), checklists K01–K17, treinamentos com certificado, NR-1.

---

## 24/09/2026 (à noite): controle de ponto com aviso

### Escala, folgas e feriados

Três tabelas novas, todas de acesso exclusivo da gestão (RLS por `can_access_restaurant`; o colaborador não lê nem pela borda):

- **`work_schedules`** — escala por pessoa. Linha com `dia_semana` repete toda semana; linha com `data` vale só naquele dia e **vence** a recorrente. Salvar uma escala nova não apaga a anterior: a antiga ganha `vigencia_fim`. Sem isso, apurar um mês passado usaria a escala de hoje.
- **`holidays`** — calendário único, com o campo `abre`: nos feriados em que o pub não abre, ninguém é cobrado por falta, e quem trabalhar entra como pendência. Semeado com nacionais, estaduais de SP e o aniversário de Mogi para 2026 e 2027 — os marcados "conferir" precisam de revisão.
- **`ponto_pendencias`** — o que foi encontrado. Chave única por pessoa/dia/tipo, então rodar o detector de novo não duplica aviso.

### O detector

`public.detectar_pendencias_ponto(unidade, início, fim)` — **em SQL, de propósito**: quem chama é o pg_cron, e assim não há chave de serviço viajando dentro de um comando agendado. É idempotente.

O que ele acha: jornada aberta, dia escalado sem marcação nenhuma, mais de 6 horas sem intervalo registrado (art. 71), sequência pela metade, mais de quatro marcações no dia, trabalho em folga ou feriado fechado, atraso e saída antecipada contra a escala. Respeita a tolerância de `payroll_settings` e trata a volta do relógio — escala de 18:00 às 01:00 é calculada certo.

Pendência que sai da lista fecha sozinha como "deixou de se aplicar (ponto corrigido ou escala alterada)". Pendência **ignorada** pelo gestor nunca reabre, e tipo que não é dele — `fora_da_cerca` — ele não mexe.

### O aviso

`public.avisar_pendencias_ponto()` detecta e manda o resumo em HTML para o gestor via Resend. Roda no pg_cron às **02:10 de São Paulo**, depois do fechamento do dia operacional. A chave **não** está no código nem em tabela comum: sai do **Vault** do Supabase (`RESEND_API_KEY` e `PONTO_AVISO_EMAIL`). Sem os segredos, a detecção roda normalmente e o motivo fica em `ponto_avisos_log` — nada falha em silêncio.

### Nas telas

`gestao.html` ganhou duas abas. **Pendências** traz o número em vermelho no alto da aba, a lista com gravidade, "lançar ponto" (que roda o detector no ato, então a pendência fecha na hora) e "tratar" — resolver com motivo, para atestado e acordo, ou ignorar de vez. **Escala** tem a grade da semana por pessoa, exceções de um dia, os feriados com o botão abre/fecha e a configuração da cerca.

### Ponto pelo celular

Decisão do Douglas em 24/09: liberar o ponto no celular. Isso abre mão da fraude-morta-por-construção do tablet fixo, então entraram três amarras:

1. **Token do totem.** O tablet do salão carrega `&t=<totem_token>` na URL. Marcação sem ele é celular.
2. **Cerca.** Celular só é aceito com o ponto da unidade marcado no mapa e dentro do raio (padrão 150 m). A **distância medida fica gravada em toda marcação**, dentro ou fora — é ela que sustenta o registro depois.
3. **Insistir com registro.** Quem está no pub com GPS ruim não fica sem bater ponto: insiste, a marcação entra com a distância e abre pendência `fora_da_cerca` para a gestão conferir. Travar a pessoa na porta seria pior do que registrar a dúvida.

`ponto_celular` nasce **desligado** nas duas unidades. Enquanto estiver assim, o celular recebe "nesta unidade o ponto é batido no tablet do salão".

O totem também avisa a própria pessoa: ao entrar com o PIN, aparecem até três pendências abertas dela dos últimos dez dias, com a nota de que a gestão já foi avisada.

### Bug achado ao testar: o selo do ponto estava quebrado

Ao exercitar a marcação pelo celular, ela voltou 500. O motivo não tinha nada a ver com a cerca: a função `time_entries_selar`, que calcula o hash encadeado, estava com `search_path = public, pg_temp`. O `digest()` do pgcrypto vive no schema `extensions`, então a chamada não resolvia — **nenhuma marcação entrava**, por nenhum caminho. Em algum momento entre 23 e 24/09 essa configuração foi reescrita; as 8 marcações do dia 23 são anteriores a isso.

`document_signatures_selar` estava com o mesmo defeito, o que significa que **assinar documento também falharia**.

Correção: qualificar o schema no corpo das funções (`extensions.digest(...)`) em vez de confiar no `search_path`, nas quatro funções que usam pgcrypto para selar ou auditar. Assim não volta a quebrar se a configuração for reescrita de fora.

Fica como recado: **selo e assinatura precisam de um teste de fumaça sempre que o banco for mexido.** A falha era silenciosa do lado de quem bate o ponto — só um 500 genérico.

### O que ficou provado no teste da cerca

Com coordenadas de teste na unidade (depois zeradas), pelo `pg_net`:

| Situação | Resposta |
|---|---|
| Celular, com a unidade desligada | 403 "nesta unidade o ponto é batido no tablet do salão" |
| Sessão com o token do totem | `origem: totem`, `exige_local: false` |
| Sessão sem o token | `origem: celular`, `exige_local: true` |
| Marcar sem localização | 409 `precisa_local` |
| Marcar a 2234 m | 409 `fora_da_cerca`, com a distância |
| Marcar a 2234 m insistindo | 200 — gravada com `origem: celular`, `distancia_m: 2234`, nota e selo, e pendência `fora_da_cerca` aberta |
| Detector rodando em cima disso | não fecha a `fora_da_cerca` — ela é assunto do gestor |

A sessão também devolveu o aviso da pessoa ("8 marcações válidas no mesmo dia"), que é o que o totem mostra depois do PIN.

A unidade voltou ao estado de entrega: sem coordenadas e com o celular desligado. A marcação de teste do dia 24 não pode ser apagada (a tabela é append-only) e sai no mesmo reset que vai limpar o colaborador `Teste Cozinha`.
