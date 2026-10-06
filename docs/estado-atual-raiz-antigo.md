# Estado atual do Portal Feitoria
_Consolidado em 25/09/2026 a partir de: claude/gestao-de-pessoas-desenho.md, claude/referencia-api-takeat.md, claude/modulo-validade-e-prazos.md, claude/historico-e-decisoes-superadas.md, claude/links-do-portal.md, claude/modulo-de-contagem.md._

A documentação do projeto foi unificada em 25/09: os documentos antigos foram fundidos nos que restaram. O mapa de qual documento serve para o quê está em `claude/links-do-portal.md`.

Este é o documento de retomada. Quem abrir o projeto amanhã lê este primeiro.

O portal é um conjunto de páginas HTML estáticas servidas pelo **GitHub Pages**, que falam só com **Edge Functions do Supabase**. O Lovable não foi usado para o portal (economia de créditos) e o Render foi descartado em 05/09. As URLs de cada página estão em `claude/links-do-portal.md`.

## 1. O que está no ar hoje

**Etiquetas e validade.** Página pública da cozinha no repositório `dougfb46/feitoria-etiquetas` (GitHub Pages, `index.html` na raiz, `?u=<token da unidade>`). PIN → produto → método de conservação → confirmação → imprimir. A validade e o lote são calculados no servidor pela Edge Function `etiqueta` (ações `session` e `print`), que é o único caminho de escrita em `label_prints`. A etiqueta é desenhada em canvas a **50 × 30 mm em 300 dpi** e enviada à **NIIMBOT B1 Pro** por Web Bluetooth; sem Bluetooth, cai na impressão do navegador.

**Integração Takeat.** A Edge Function `takeat-sync-catalogo` espelha `/v1/inputs` e `/v1/intermediaries` em `takeat_catalog`. O segredo `TAKEAT_API_KEY` **já está configurado** no Supabase e a sincronização **já rodou em 24/09**. `takeat-auth-status` confere a credencial. A função temporária `takeat-probe` ainda existe e deve ser apagada.

**Ponto e folha.** `ponto.html` é o totem do tablet fixo do salão: PIN, foto pela câmera e sequência travada (entrada → saída para intervalo → volta do intervalo → saída), com um botão habilitado por vez. Ao entrar com o PIN, o totem mostra à própria pessoa até três pendências abertas dela dos últimos dez dias, com a nota de que a gestão já foi avisada. O **ponto pelo celular foi liberado em 24/09**, com cerca por GPS. `gestao-folha` (ações `parametros`, `salvar_parametros`, `folha` e `folha_pdf`) apura por colaborador e por dia operacional as quatro marcações, intervalo, horas trabalhadas, crédito e débito depois da tolerância (art. 58 § 1º da CLT) e minutos noturnos. A jornada esperada vem de `employee_records.jornada_semanal_horas` / `dias_por_semana` — 44h em 6 dias dá 7h20 por dia, batendo com a coluna "Horas normais" do relatório da Pontomais. O PDF sai em paisagem, com texto selecionável, cabeçalho de tabela repetido a cada página e linha de totais.

**Documentos e assinatura.** `portal.html` é o portal do colaborador no celular: entra com PIN + data de nascimento + vínculo com o aparelho, lista os documentos e assina reinserindo o PIN. Os PDFs são gravados no bucket privado `documentos` com SHA-256 e publicados em `documents`. Funções `portal`, `gestao-documentos`, `gestao-modelos` e `gestao-gerar`.

**Escala e pendências.** `gestao.html` é a tela do gestor, com as abas Equipe, Ponto do dia, Documentos, Folha de ponto, **Pendências** e **Escala**. Pendências mostra o número em vermelho no alto da aba, a lista com gravidade, "lançar ponto" (que roda o detector no ato, então a pendência fecha na hora) e "tratar" — resolver com motivo, para atestado e acordo, ou ignorar de vez. Escala tem a grade da semana por pessoa, exceções de um dia, os feriados com o botão abre/fecha e a configuração da cerca. Backend em `gestao-equipe` e `gestao-pendencias`.

**Contagem de estoque** (construída em 25/09, detalhe completo em `claude/modulo-de-contagem.md`): compara o contado com o que a Takeat diz que tem e devolve o número a digitar em Perdas e Sobras. Banco, Edge Function `contagem` v3 e `contagem.html` prontos e testados de ponta a ponta; falta publicar o `contagem.html` no GitHub e definir os PINs, e o relatório ainda não aparece no `gestao.html`.

## 2. Infraestrutura

**Supabase** — projeto `portal-feitoria`, ref `kujelbcbrcmkitzyswbh`, org "Feitoria Pub Cafe", região **sa-east-1** (São Paulo), **plano gratuito**. URL `https://kujelbcbrcmkitzyswbh.supabase.co`. Atenção: **projeto gratuito pausa após ~7 dias sem uso**; `restore_project` traz de volta sem perder dados.

Login do dono: dougfb46@gmail.com, papel `dono`, valendo para as duas unidades. A senha provisória da criação ainda precisa ser trocada.

Duas unidades. Tokens públicos da cozinha: PUB Mogi `48f7713d-add7-4246-b5f1-c03e3a8d9ce2`, Prainha Buena Onda `cd5b3853-9c13-4f8b-9171-b552d65e27ad`. Tokens do totem: PUB Mogi `576cee22-d66f-446b-aca8-639d5c1ec4fe`, Prainha `e1e1238a-7b5b-4150-b1fc-6db336832852`. Trocar o `totem_token` no banco invalida a URL antiga do tablet — é o caminho se o link vazar.

**Edge Functions existentes:** `etiqueta` (verify_jwt OFF), `ponto`, `portal`, `gestao-equipe`, `gestao-documentos`, `gestao-gerar`, `gestao-modelos`, `gestao-folha`, `gestao-pendencias`, `contagem` (v3), `takeat-auth-status`, `takeat-sync-catalogo` (verify_jwt ON) e a temporária `takeat-probe`, que deve ser apagada.

**Tabelas principais, por módulo:**

| Módulo | Tabelas e objetos |
|---|---|
| Fundação | `restaurants` (com `takeat_restaurant_id`), `profiles`, `user_roles`; enums `app_role` e `storage_method`; trigger `handle_new_user`; funções `has_role` e `can_access_restaurant` |
| Equipe e PIN | `employees` (`pin_hash` bcrypt), `employee_records`; funções `set_employee_pin` e `verificar_pin` |
| Etiquetas | `label_products`, `label_shelf_lives`, `label_prints`; view `vw_label_products_vinculo` (campos `avulsa` e `nome_divergente`) |
| Takeat | `takeat_catalog` (enum `takeat_kind`, `raw.centro_custo`, coluna gerada `categoria`), trigger `absorver_provisorio()`, índice único `takeat_catalog_nome_unico (restaurant_id, kind, name_key)` |
| Ponto e folha | `time_entries` (append-only), `payroll_settings`, `work_schedules`, `holidays`, `ponto_pendencias`, `ponto_avisos_log`; funções `time_entries_selar`, `public.detectar_pendencias_ponto(unidade, início, fim)`, `public.avisar_pendencias_ponto()` |
| Documentos | `documents`, `document_signatures`, `document_templates`; função `document_signatures_selar`; bucket privado `documentos` |
| Contagem | `stock_counts`, `stock_count_lines`, `stock_count_entries`; `converter_medida(q, de, para)`; trigger `somar_contagem()`; view `vw_contagem_ajustes` |
| Perdas e sobras | view `vw_perdas_sobras_diario` |

Migrations aplicadas até aqui: `fundacao_unidades_perfis_papeis`, `equipe_pins_e_modulo_etiquetas`, `rls_todas_as_tabelas` (RLS em tudo; `label_prints` só com policy de SELECT, escrita exclusiva da Edge Function), `restringir_execute_das_funcoes` (revoke execute das funções security definer de `anon`/`public`), `catalogo_takeat_e_vinculo`, `unidade_ganha_id_da_takeat`, `modulo_de_contagem` e `categoria_do_catalogo`. As três tabelas de escala (`work_schedules`, `holidays`, `ponto_pendencias`) são de acesso exclusivo da gestão, com RLS por `can_access_restaurant` — o colaborador não lê nem pela borda.

**Rotinas agendadas:** `vigia-do-ponto`, no pg_cron, todo dia às **05:10 UTC (02:10 em São Paulo)**, depois do fechamento do dia operacional. Detecta as inconsistências do ponto e manda o resumo em HTML por e-mail ao gestor via Resend. As chaves saem do **Vault** do Supabase (`RESEND_API_KEY` e `PONTO_AVISO_EMAIL`); sem os segredos, a detecção roda normalmente e o motivo fica em `ponto_avisos_log` — nada falha em silêncio.

A sincronização diária do catálogo Takeat **ainda não está agendada**: falta decidir o horário e se vai por `pg_cron` ou pelo agendador da própria Supabase. `pg_net` já está instalado.

Receita para disparar qualquer Edge Function de dentro do banco (o shell deste ambiente não alcança o domínio da Supabase):

```sql
select net.http_post(
  url := 'https://kujelbcbrcmkitzyswbh.supabase.co/functions/v1/takeat-sync-catalogo',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <anon>'),
  body := '{}'::jsonb, timeout_milliseconds := 60000);
-- resposta em net._http_response
```

## 3. Regras do sistema que não se negociam

- **Append-only com hash encadeado.** `time_entries` bloqueia UPDATE e DELETE por trigger, e cada linha carrega o hash SHA-256 encadeado da anterior. Correção é linha nova apontando para a original, com autor e motivo. A folha ignora a marcação substituída; o histórico fica para prova. O mesmo selo vale para as assinaturas de documento.
- **Dia operacional fecha às 01:00.** Toda apuração de ponto, folha e perdas agrupa por dia operacional, não por meia-noite civil. Escala de 18:00 às 01:00 é calculada certo, com a volta do relógio tratada.
- **Sem reconhecimento facial.** A foto do ponto é só evidência — evita a categoria de biometria sensível da LGPD.
- **Nenhum percentual de folha chumbado no código.** Hora extra, adicional noturno, horário de início do noturno, hora noturna reduzida e tolerância vivem em `payroll_settings`, com vigência. Salvar cria vigência nova; folha já gerada não é reescrita.
- **Papéis em tabela própria.** Permissão vem de `user_roles`, lida por `has_role` e `can_access_restaurant` — nunca de campo solto no perfil.
- **Segredo nunca no navegador.** A página estática só fala com Edge Function; chaves ficam nos secrets do projeto ou no Vault. O detector de pendências é escrito em SQL de propósito: quem o chama é o pg_cron, e assim não há chave de serviço viajando dentro de um comando agendado.
- **Edge Function só devolve JSON.** Página HTML mora no GitHub Pages (ver armadilha do `content-type` abaixo).
- **Modelos de RH não vão para o GitHub.** São de terceiro, com direitos reservados, e o repositório é público. Ficam no bucket privado. A Ficha de Registro concentra dado sensível (CPF, RG, filiação, dependentes, endereço) e é visível só para a gestão.

## 4. Números de hoje

- **134 produtos de etiqueta ativos**, todos com prazo cadastrado (eram 18 no começo). 55 estão vinculados ao catálogo da Takeat e 79 ficaram sem correspondente lá. Os 26 preparos semeados por chute estão desativados. A tabela de prazos por categoria, os seis prazos por analogia ainda a confirmar, as equivalências de nome e as normalizações de grafia estão em `claude/modulo-validade-e-prazos.md`. Vale saber de cor uma correção da cozinha: pastel congelado é **30 dias**, não os 90 que estavam semeados.
- **Última sincronização com a Takeat (24/09, PUB Mogi, 27 segundos):** insumos — 253 recebidos, **250 gravados**, 2 desativados; intermediários — 18 recebidos, **18 gravados**, 0 desativados. As 268 linhas provisórias (`takeat_id = 'planilha:<nome>'`) foram todas absorvidas, não sobrou nenhuma. Os 55 vínculos em `label_products` continuaram de pé. **Açúcar Cristal** e **Tofu 1,5kg** foram desativados: estavam na planilha de 17/09 e não vêm mais da API; nenhum produto de etiqueta apontava para eles. Nomes repetidos na Takeat: "linyker berna" e "sapato antiderrapante cozinha epi".
- **Quatro pessoas batem ponto**, sendo que a ficha da quarta (Valéria) ainda falta. Há 8 marcações válidas do dia 23/09 e uma marcação de teste do dia 24, que não pode ser apagada porque a tabela é append-only e sai no reset do colaborador `Teste Cozinha`.
- **23 modelos de documento de RH** (kit V2 "Contrate Sem Medo", de autoria da advogada Rafaela Pereira Morais de Oliveira) já inventariados e mapeados campo a campo; 15 deles saem na admissão. Detalhe em `claude/documentos-rh-modelos.md`. O gerador formulário → PDF ainda não está construído.

Nenhum produto tem unidade de medida cadastrada. Não bloqueia: a quantidade é opcional na etiqueta, atrás do checkbox de porcionamento.

## 5. Armadilhas já pagas

**O gateway descarta o `content-type`.** Qualquer HTML servido por Edge Function aparece como código no navegador, com acentos quebrados. Confirmado em 17/09 com uma função de uma linha. Não se conserta no código. Daí a regra: função devolve JSON, página mora no GitHub Pages.

**O `search_path` derrubou o selo do ponto e das assinaturas.** A marcação pelo celular voltava 500 e o motivo não tinha nada a ver com a cerca: `time_entries_selar`, que calcula o hash encadeado, estava com `search_path = public, pg_temp`. O `digest()` do pgcrypto vive no schema `extensions`, então a chamada não resolvia e **nenhuma marcação entrava, por nenhum caminho**. A configuração foi reescrita em algum momento entre 23 e 24/09; as 8 marcações do dia 23 são anteriores a isso. `document_signatures_selar` tinha o mesmo defeito, ou seja, **assinar documento também falharia**. Correção: qualificar o schema no corpo das funções (`extensions.digest(...)`) em vez de confiar no `search_path`, nas quatro funções que usam pgcrypto para selar ou auditar. Recado que fica: **selo e assinatura precisam de teste de fumaça sempre que o banco for mexido** — a falha era silenciosa para quem batia o ponto, só um 500 genérico.

**O vínculo etiqueta ↔ Takeat é pelo nome.** A API de insumos e intermediários **não devolve identificador**. O payload vem assim:

```json
{ "name": "Farofa da Casa", "unidade": "KG", "quantidade": "0.2",
  "ideal_stock": "3", "minimum_stock": "1",
  "unitary_price": "28.62", "total_value": "5.72" }
```

Por isso `takeat_catalog.takeat_id` é nulo em todas as linhas e a chave real é o índice único `takeat_catalog_nome_unico (restaurant_id, kind, name_key)`. Consequência a carregar para sempre: se alguém renomear um insumo na Takeat, a sincronização seguinte trata como item novo, desativa o antigo, e o produto de etiqueta que apontava para ele **fica órfão em silêncio**. Vale checar a aba Produtos e prazos depois de qualquer mexida grande no cadastro da Takeat. O lado bom do payload é que vêm `quantidade`, `ideal_stock`, `minimum_stock` e `unitary_price` — foi isso que permitiu construir o módulo de contagem.

**A view `vw_perdas_sobras_diario` agrupava errado (corrigido em 25/09).** Ela subtraía 3 horas do timestamp para descobrir o dia, em vez de chamar `public.data_operacional`. Com isso, tudo que acontecia entre 01:00 e 03:00 caía no dia anterior e as perdas e sobras da madrugada apareciam na data errada. A view passou a usar `public.data_operacional`, que é a única definição de dia operacional do sistema. A lição é a mesma das outras: quem precisa do dia operacional chama a função, nunca reimplementa a conta.

**Impressora.** A **NIIMBOT B1 Pro** é a impressora da Feitoria. A Zebra ZD220 de transferência térmica aparece em orçamento antigo porque era a impressora da Suflex — não é o caminho daqui.

## 6. Pendências

### Dependem do Douglas

- Apagar a Edge Function temporária `takeat-probe`.
- Limpar os dados de teste antes de entrar em produção: colaborador `Teste Cozinha` (PIN 1234), suas marcações e a marcação de teste do dia 24. É reset deliberado, porque a tabela é append-only.
- Enviar a ficha da Valéria, a quarta pessoa que bate ponto.
- Marcar o ponto da unidade no mapa (aba Escala → "Usar onde estou", com o celular dentro do pub) e ligar `ponto_celular` na unidade. Ele nasce **desligado** nas duas unidades; enquanto estiver assim, o celular recebe "nesta unidade o ponto é batido no tablet do salão". O raio padrão é 150 m.
- Cadastrar no Vault do Supabase os segredos `RESEND_API_KEY` e `PONTO_AVISO_EMAIL`, para o aviso diário sair por e-mail. Sem eles, a detecção roda e as pendências ficam só no painel.
- Publicar o `contagem.html` no GitHub e definir os PINs — nada do módulo de contagem funciona antes disso.
- Ligar a NIIMBOT B1 Pro e testar; se a etiqueta sair fraca, subir a densidade de 3 para 4.
- Trocar a senha provisória do login do dono.
- Confirmar com a cozinha os 6 prazos por analogia, ou desativar os preparos que não se produz mais.
- Decidir o que fazer com os **79 produtos sem correspondente no Takeat** — quase todo o bloco de secos, temperos e congelados: entram lá ou ficam só no sistema de etiquetas.
- Cadastrar **Pastel de Banana** e **Pastel de Maçã** como intermediários na Takeat: a cozinha produz e não existem lá.
- Revisar os feriados marcados "conferir" no calendário `holidays` (semeado com nacionais, estaduais de SP e o aniversário de Mogi para 2026 e 2027).
- Preencher `restaurants.takeat_restaurant_id` das duas unidades, se a conta for multi-restaurante.
- Agendar a sincronização diária do catálogo Takeat: decidir o horário e se vai por `pg_cron` ou pelo agendador da Supabase.
- Definir os dados fixos da empresa para o gerador de documentos: razão social, CNPJ, endereço e comarca.
- Enviar os modelos de RH que faltam.
- Domínio e landing page (passo 00, ainda não iniciado).

### Dependem de terceiros (contabilidade, advogado)

- **Enquadramento sindical.** A Feitoria vinha sendo tratada por outro sindicato e o SINTHORESP notificou. Enquanto a contabilidade não responde, os parâmetros de folha seguem **semeados e marcados como não confirmados**: 50% de hora extra, 60% na segunda faixa e 20% de adicional noturno. A tela avisa disso.
- **Minuta de LGPD** aguarda revisão da contabilidade e do advogado.
- **Revisão jurídica dos modelos de RH**, adaptando à realidade de São Paulo, à convenção coletiva de bares e restaurantes e ao fato de a Feitoria ter freelas além de CLT. O modelo 06 (Contrato de Prestação de Serviços) tem erros a corrigir antes de qualquer uso: `[2% (dez por cento)]`, `[Goiânia do Estado de Goiás]` e `[@gmail]`, resquícios do documento original.

### Próximos módulos a construir

- **Admitir colaborador**: converter os PDFs dos modelos em HTML editável com os campos canônicos e gerar de uma vez os 15 documentos de admissão, prontos para assinatura no portal, com a versão do modelo gravada.
- **Vendas e caixa da Takeat** — 24 meses de histórico, puxados em janelas de 3 dias.
- **Checklists K01–K17.**
- **Treinamentos com certificado** e **NR-1**.
- Levar o **relatório de contagem** para dentro do `gestao.html`; hoje ele só existe na própria tela de contagem.
- Usar `ideal_stock` e `minimum_stock` do payload da Takeat para alerta de reposição — nada disso está construído.
