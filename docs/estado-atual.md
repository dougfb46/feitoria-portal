# Estado atual do Portal Feitoria
_Consolidado em 25/09/2026, atualizado em 29/09 (revisão externa conferida, limite de PIN, renderização segura, tela de operação e módulo de NR-1)._

Este é o documento de retomada. Quem abrir o projeto amanhã lê este primeiro. O mapa de qual documento serve para o quê está em `claude/links-do-portal.md`.

O portal é um conjunto de páginas HTML estáticas servidas pelo **GitHub Pages**, que falam só com **Edge Functions do Supabase**. O Lovable não foi usado para o portal (economia de créditos) e o Render foi descartado em 05/09. As URLs de cada página estão em `claude/links-do-portal.md`.

## 1. O que está no ar hoje

**Etiquetas e validade.** Página pública da cozinha no repositório `dougfb46/feitoria-etiquetas` (GitHub Pages, `index.html` na raiz, `?u=<token da unidade>`). PIN → produto → método de conservação → confirmação → imprimir. A validade e o lote são calculados no servidor pela Edge Function `etiqueta` (ações `session` e `print`), único caminho de escrita em `label_prints`. A etiqueta é desenhada em canvas a **50 × 30 mm em 300 dpi** e enviada à **NIIMBOT B1 Pro** por Web Bluetooth; sem Bluetooth, cai na impressão do navegador. **Atenção: este repositório tem um defeito confirmado que corrompe dado** — ver `av-qtd` em `claude/revisao-28-09-conferida.md`.

**Integração Takeat.** A Edge Function `takeat-sync-catalogo` espelha `/v1/inputs` e `/v1/intermediaries` em `takeat_catalog`. O segredo `TAKEAT_API_KEY` já está configurado e a sincronização já rodou em 24/09. `takeat-auth-status` confere a credencial. A função temporária `takeat-probe` ainda existe e deve ser apagada.

**Ponto e folha.** `ponto.html` serve o tablet fixo do salão e o celular: PIN, foto pela câmera e sequência travada (entrada → saída para intervalo → volta do intervalo → saída), com um botão habilitado por vez. Ao entrar, a pessoa vê até três pendências abertas dela dos últimos dez dias. O ponto pelo celular foi liberado em 24/09, com cerca por GPS. `gestao-folha` (ações `parametros`, `salvar_parametros`, `folha`, `folha_pdf`) apura por colaborador e por dia operacional as quatro marcações, intervalo, horas trabalhadas, crédito e débito depois da tolerância (art. 58 § 1º da CLT) e minutos noturnos. A jornada esperada vem de `employee_records.jornada_semanal_horas` / `dias_por_semana` — 44 h em 6 dias dá 7h20 por dia, batendo com a coluna "Horas normais" do relatório da Pontomais. O PDF sai em paisagem, com texto selecionável, cabeçalho repetido e linha de totais. Ponto e folha valem para CLT e sócio: `registra_ponto` é travado no servidor para os demais.

**Documentos e assinatura.** `portal.html` é o portal do colaborador no celular: entra com PIN + data de nascimento + vínculo com o aparelho, lista os documentos e assina reinserindo o PIN. Os PDFs ficam no bucket privado `documentos` com SHA-256 e são publicados em `documents`. Funções `portal`, `gestao-documentos`, `gestao-modelos`, `gestao-gerar`.

**Perfil de acesso ao portal.** `employees.perfil_portal` decide quem entra e o que vê: `sem_acesso` (padrão de quem é cadastrado novo), `treinamentos` (treinamento, certificado próprio e mural) e `completo`. Os quatro CLT ativos estão em `completo`. Os tipos que o perfil `treinamentos` alcança vêm de `portal_tipos_treinamento`, não do código. O filtro vale em todas as ações da função `portal` e a verificação do perfil acontece antes do vínculo de aparelho.

**Escala e pendências.** `gestao.html` é a tela do gestor. Abas: Equipe, Ponto do dia, Pendências, Escala, Operação, NR-1, Documentos e Folha de ponto. Pendências traz o número em vermelho no alto da aba, a lista com gravidade, "lançar ponto" (roda o detector no ato) e "tratar". Escala tem a grade da semana por pessoa, exceções de um dia, feriados com botão abre/fecha e a configuração da cerca. Backend em `gestao-equipe` e `gestao-pendencias`. **Escala, ponto e folha de freela ficaram fora do portal por decisão de 25/09** e continuam na planilha.

**Contagem de estoque** (detalhe em `claude/modulo-de-contagem.md`): compara o contado com o que a Takeat diz que tem e devolve o número a digitar em Perdas e Sobras. Banco, Edge Function `contagem` v3 e `contagem.html` prontos e testados; falta publicar o `contagem.html` no GitHub e definir os PINs, e o relatório ainda não aparece no `gestao.html`.

**Tela de operação** (28–29/09). `operacao.html`, pública com o token da unidade, sem PIN: mapa das 54 mesas, descritivo dos 37 chopes, posições do turno, escalas publicadas, canal de recado e dicas. Do lado da gestão, a aba Operação tem a caixa de entrada dos recados, as sete posições do turno e a publicação de escala (equipe, freelas, música, eventos). A escala publicada é **texto livre** de propósito: a montagem continua na planilha, e um formulário aqui só recriaria a planilha pela metade.

**Canal de recado com dois modos.** Assinado passa pelo PIN e permite resposta. Anônimo não guarda autor, aparelho nem IP — e isso é **restrição do banco**, não promessa de tela: `check (anonimo and employee_id is null and employee_nome is null) or (not anonimo and employee_id is not null)`. Nem o caminho assinado guarda IP ou aparelho, para que o anônimo não se denuncie por ser a única linha sem metadado. O limite contra abuso é de volume por unidade (40 por hora), não por pessoa.

**NR-1 psicossocial** (29/09, detalhe em `claude/modulo-nr1.md`). Inventário de risco versionado em `nr1_riscos`, informativos em `nr1_informativos`, tela pública `nr1.html` sem senha, e o canal de recado ganhando os assuntos `sobrecarga_ou_pressao` e `assedio_ou_conduta`. A aba NR-1 da gestão mostra o inventário, os contadores (riscos, ações com prazo vencido, relatos pelo canal) e o link público pronto para copiar. **O inventário está vazio de propósito** — os riscos são do Douglas, não meus.

## 2. Infraestrutura

**Supabase** — projeto `portal-feitoria`, ref `kujelbcbrcmkitzyswbh`, org "Feitoria Pub Cafe", região **sa-east-1**, **plano gratuito**. URL `https://kujelbcbrcmkitzyswbh.supabase.co`. **Projeto gratuito pausa após ~7 dias sem uso**; `restore_project` traz de volta sem perder dados.

Login do dono: dougfb46@gmail.com, papel `dono`, valendo para as duas unidades. A senha provisória da criação ainda precisa ser trocada.

Duas unidades. Tokens públicos: PUB Mogi `48f7713d-add7-4246-b5f1-c03e3a8d9ce2`, Prainha Buena Onda `cd5b3853-9c13-4f8b-9171-b552d65e27ad`. Tokens do totem: PUB Mogi `576cee22-d66f-446b-aca8-639d5c1ec4fe`, Prainha `e1e1238a-7b5b-4150-b1fc-6db336832852`. Trocar o `totem_token` invalida a URL antiga do tablet — é o caminho se o link vazar.

**Edge Functions:** `etiqueta` (verify_jwt OFF), `ponto`, `portal` (v5), `operacao` (v2, verify_jwt OFF com checagem por ação), `gestao-equipe`, `gestao-documentos`, `gestao-gerar`, `gestao-modelos`, `gestao-folha`, `gestao-pendencias`, `contagem` (v3), `takeat-auth-status`, `takeat-sync-catalogo`, e a temporária `takeat-probe`, que deve ser apagada.

**Tabelas principais, por módulo:**

| Módulo | Tabelas e objetos |
|---|---|
| Fundação | `restaurants` (com `takeat_restaurant_id` e `email_avisos`), `profiles`, `user_roles`; enums `app_role` e `storage_method`; trigger `handle_new_user`; funções `has_role` e `can_access_restaurant` |
| Equipe e PIN | `employees` (`pin_hash` bcrypt, `perfil_portal`), `employee_records`; `set_employee_pin`, `verificar_pin`, `verificar_pin_limitado`; `pin_tentativas` |
| Acesso ao portal | `portal_tipos_treinamento`, `portal_devices` |
| Etiquetas | `label_products`, `label_shelf_lives`, `label_prints`; view `vw_label_products_vinculo` |
| Takeat | `takeat_catalog`, trigger `absorver_provisorio()`, índice único `takeat_catalog_nome_unico` |
| Ponto e folha | `time_entries` (append-only), `payroll_settings`, `work_schedules`, `holidays`, `ponto_pendencias`, `ponto_avisos_log`; `time_entries_selar`, `detectar_pendencias_ponto`, `avisar_pendencias_ponto` |
| Documentos | `documents`, `document_signatures`, `document_templates`; `document_signatures_selar`; bucket privado `documentos` |
| Contagem | `stock_counts`, `stock_count_lines`, `stock_count_entries`; `converter_medida`; `somar_contagem()`; view `vw_contagem_ajustes` |
| Operação | `operacao_recados`, `turno_posicoes`, `escala_publicada`; `pode_receber_recado` |
| NR-1 | `nr1_riscos` (append-only por trigger), `nr1_informativos`; view `vw_nr1_riscos_atuais` |
| Perdas e sobras | view `vw_perdas_sobras_diario` |

Migrations: `fundacao_unidades_perfis_papeis`, `equipe_pins_e_modulo_etiquetas`, `rls_todas_as_tabelas`, `restringir_execute_das_funcoes`, `catalogo_takeat_e_vinculo`, `unidade_ganha_id_da_takeat`, `modulo_de_contagem`, `categoria_do_catalogo`, `operacao_recados_posicoes_e_escala`, `nr1_riscos_informativos_e_canal`.

**Rotina agendada:** `vigia-do-ponto`, pg_cron, todo dia às **05:10 UTC (02:10 em São Paulo)**, depois do fechamento do dia operacional. A chave da Resend sai do **Vault**; o endereço que recebe o aviso fica em `restaurants.email_avisos`, porque é configuração de unidade e não segredo. Sem a chave, a detecção roda e o motivo fica em `ponto_avisos_log` — nada falha em silêncio.

A sincronização diária do catálogo Takeat **ainda não está agendada**: falta decidir o horário e se vai por `pg_cron` ou pelo agendador da Supabase. `pg_net` já está instalado, e existem os atalhos `public.chamar_ponto`, `chamar_portal` e `chamar_operacao` para disparar função de dentro do banco (o shell deste ambiente não alcança o domínio da Supabase).

## 3. Regras do sistema que não se negociam

- **Append-only com hash encadeado.** `time_entries` bloqueia UPDATE e DELETE por trigger, e cada linha carrega o SHA-256 encadeado da anterior. Correção é linha nova apontando para a original, com autor e motivo. O mesmo selo vale para assinatura de documento. `nr1_riscos` segue a mesma ideia sem hash: UPDATE e DELETE recusados, revisão aponta para a anterior em `substitui`.
- **Dia operacional fecha às 01:00.** Toda apuração agrupa por dia operacional. Quem precisa do dia operacional chama `public.data_operacional`, nunca reimplementa a conta.
- **Sem reconhecimento facial.** A foto do ponto é só evidência — evita a categoria de biometria sensível da LGPD.
- **Nenhum percentual de folha chumbado no código.** Vive em `payroll_settings`, com vigência.
- **Papéis em tabela própria.** Permissão vem de `user_roles`, lida por `has_role` e `can_access_restaurant`.
- **Acesso ao portal é ato deliberado.** Quem é cadastrado novo nasce `sem_acesso`.
- **Segredo nunca no navegador.** Página estática só fala com Edge Function. O detector de pendências é SQL de propósito: quem o chama é o pg_cron, e assim não há chave de serviço dentro de um comando agendado.
- **Edge Function só devolve JSON.** Página HTML mora no GitHub Pages.
- **Zero policy de RLS para `anon`.** O navegador com a chave pública não lê tabela alguma; tudo o que é público passa por Edge Function com service_role e checagem por ação.
- **Tentativa de PIN tem teto.** `verificar_pin_limitado`: 15 erros por IP e unidade em 10 minutos, ligado em `ponto`, `portal` e no recado assinado. No `portal` a data de nascimento também conta. O PIN tentado nunca é gravado.
- **Dado do servidor entra como texto, nunca como marcação.** `esc()` em toda interpolação e `guarde()` no lugar de JSON dentro de atributo — ver o A07 em `claude/revisao-28-09-conferida.md`.
- **Modelos de RH não vão para o GitHub.** São de terceiro, com direitos reservados, e o repositório é público. A Ficha de Registro concentra dado sensível e é visível só para a gestão.

## 4. Números de hoje

- **134 produtos de etiqueta ativos**, todos com prazo. 55 vinculados ao catálogo da Takeat, 79 sem correspondente. Os 26 preparos semeados por chute estão desativados. Correção da cozinha para saber de cor: pastel congelado é **30 dias**, não 90.
- **Última sincronização com a Takeat** (24/09, PUB Mogi, 27 s): insumos 253 recebidos / 250 gravados / 2 desativados; intermediários 18 / 18 / 0. As 268 linhas provisórias foram absorvidas. **Açúcar Cristal** e **Tofu 1,5 kg** desativados. Nomes repetidos na Takeat: "linyker berna" e "sapato antiderrapante cozinha epi".
- **Quatro pessoas batem ponto**; a ficha da Valéria ainda falta e a Kely Fogaça está sem ficha e sem data de nascimento. Só o colaborador de teste tem PIN definido.
- **54 mesas** com coordenada no mapa (áreas Chalé 14, Central 5, Jardim 4, Salão externo 24, Deck 7 — a divisão por área precisa da sua confirmação). As mesas 19, 20 e 31 não existem.
- **37 chopes** descritos. Dois pedem conferência: APA Comet (sem vasilhame) e Chope de Vinho (sem descrição e sem IBU).
- **23 modelos de documento de RH** inventariados e mapeados campo a campo; 15 saem na admissão. **Só 2 estão importados no banco.**
- **5 informativos de NR-1** publicados; **inventário de risco vazio**.

Nenhum produto tem unidade de medida cadastrada. Não bloqueia: a quantidade é opcional na etiqueta.

## 5. Armadilhas já pagas

**O gateway descarta o `content-type`.** HTML servido por Edge Function aparece como código, com acentos quebrados. Confirmado em 17/09. Não se conserta no código.

**O `search_path` derrubou o selo do ponto e das assinaturas.** `time_entries_selar` estava com `search_path = public, pg_temp` e o `digest()` do pgcrypto vive em `extensions`: **nenhuma marcação entrava, por nenhum caminho**, e só aparecia como 500 genérico para quem batia o ponto. `document_signatures_selar` tinha o mesmo defeito. Correção: qualificar o schema no corpo das quatro funções (`extensions.digest(...)`). Recado que fica: **selo e assinatura precisam de teste de fumaça sempre que o banco for mexido**.

**O vínculo etiqueta ↔ Takeat é pelo nome.** A API de insumos e intermediários não devolve identificador — `takeat_catalog.takeat_id` é nulo em todas as linhas e a chave real é o índice único por nome normalizado. Se alguém renomear um insumo na Takeat, a sincronização seguinte trata como item novo, desativa o antigo, e o produto de etiqueta **fica órfão em silêncio**. Vale checar a aba Produtos e prazos depois de qualquer mexida grande no cadastro da Takeat.

**A view `vw_perdas_sobras_diario` agrupava errado** (corrigido em 25/09): subtraía 3 horas em vez de chamar `public.data_operacional`, então tudo entre 01:00 e 03:00 caía no dia anterior.

**O PIN não tinha limite de tentativas** (corrigido em 28–29/09). A função `ponto` é pública por desenho e o token da unidade viaja na URL; varrer 10.000 PINs de 4 dígitos era trivial, e com o PIN em mãos dá para bater ponto no lugar de outra pessoa. Era o furo mais sério do sistema — mais do que qualquer item da revisão externa. Ver `claude/revisao-28-09-conferida.md`.

**JSON dentro de atributo HTML** (corrigido em 29/09). Onze botões levavam o objeto inteiro como JSON num atributo delimitado por apóstrofo. Um sobrenome como D'Alessandro partia o atributo e **o botão desaparecia**; um nome com `<script>` executava. Provado em Chromium antes e depois da correção.

**Impressora.** A **NIIMBOT B1 Pro** é a impressora da Feitoria. A Zebra ZD220 aparece em orçamento antigo porque era a impressora da Suflex.

**Chamada concorrente a Edge Function fria devolve 503.** Disparar três invocações da mesma função no mesmo instante pelo `pg_net` fez uma delas errar na primeira consulta ao banco. O tratamento está certo — devolve "instabilidade momentânea", nunca "PIN incorreto" —, mas vale saber que existe antes de culpar o código.

## 6. Pendências

### Dependem do Douglas

- Subir no GitHub as versões novas de `ponto.html`, `portal.html`, `gestao.html`, `operacao.html` e `nr1.html`.
- **Exercitar as ações de gestão que eu não consigo testar daqui** (dependem de login no navegador): aba Operação — tratar recado, posições, publicar escala; aba NR-1 — registrar risco e editar informativo.
- **Preencher o inventário de NR-1** com os riscos reais da casa. `claude/modulo-nr1.md` traz oito candidatos para você aceitar, recusar ou reescrever.
- Definir os PINs dos quatro CLT.
- Corrigir o `av-qtd` no repositório de etiquetas — é o último defeito conhecido que corrompe dado a cada uso.
- Limpar os dados de teste: colaborador `Teste Cozinha` (PIN 1234) e suas marcações, os recados de teste, as posições semeadas e a escala de música de exemplo.
- Apagar a Edge Function temporária `takeat-probe`.
- Enviar a ficha da Valéria; completar Kely Fogaça (ficha e data de nascimento).
- Importar os 19 modelos de documento que faltam (só 2 estão no banco).
- Marcar o ponto da unidade no mapa (aba Escala → "Usar onde estou", dentro do pub) e ligar `ponto_celular`. Nasce desligado nas duas unidades; o raio padrão é 150 m.
- Confirmar a divisão das 54 mesas por área e os dois chopes marcados para conferir.
- Definir a escala da semana e quais freelas entram no portal como `treinamentos`.
- Publicar o `contagem.html` no GitHub e definir os PINs.
- Ligar a NIIMBOT B1 Pro e testar; se sair fraca, subir a densidade de 3 para 4.
- Trocar a senha provisória do login do dono.
- Confirmar com a cozinha os 6 prazos por analogia.
- Decidir o que fazer com os **79 produtos sem correspondente no Takeat**.
- Cadastrar **Pastel de Banana** e **Pastel de Maçã** como intermediários na Takeat.
- Revisar os feriados marcados "conferir" em `holidays`.
- Preencher `restaurants.takeat_restaurant_id` das duas unidades, se a conta for multi-restaurante.
- Agendar a sincronização diária do catálogo Takeat.
- Definir os dados fixos da empresa para o gerador de documentos: razão social, CNPJ, endereço e comarca.
- Domínio e landing page (passo 00, ainda não iniciado).

### Dependem de terceiros (contabilidade, advogado, quem assina o PGR)

- **Enquadramento sindical.** A Feitoria vinha sendo tratada por outro sindicato e o SINTHORESP notificou. Enquanto a contabilidade não responde, os parâmetros de folha seguem semeados e **marcados como não confirmados**: 50% de hora extra, 60% na segunda faixa, 20% de adicional noturno. A tela avisa disso.
- **Minuta de LGPD** aguarda revisão da contabilidade e do advogado.
- **Revisão jurídica dos modelos de RH.** O modelo 06 (Contrato de Prestação de Serviços) tem erros a corrigir antes de qualquer uso: `[2% (dez por cento)]`, `[Goiânia do Estado de Goiás]` e `[@gmail]`.
- **Incorporar o inventário psicossocial ao PGR**, com quem assina por ele. A NR-1 continua em vigor; o que o STF suspendeu (ADPF 1.316, prorrogada em 24/09/2026) é só o efeito punitivo de cinco itens.

### Próximos módulos a construir

- **Treinamentos com certificado.** O perfil `treinamentos` já existe esperando, e os contratos `treinamento.schema.json` + `T01` já foram entregues. É o próximo da fila, e a NR-1 também cobra registro de treinamento de liderança.
- **Checklists K01–K17.** `checklist.schema.json` e `K01-abertura-geral.json` entregues; falta o motor e o caminho de reenvio de correção.
- **Admitir colaborador**: converter os modelos em HTML editável com os campos canônicos e gerar os 15 documentos de admissão de uma vez, prontos para assinatura, com a versão do modelo gravada.
- **Vendas e caixa da Takeat** — 24 meses de histórico, em janelas de 3 dias.
- Publicação automática de holerite e recibo de vale-transporte.
- Levar o **relatório de contagem** para dentro do `gestao.html`.
- Usar `ideal_stock` e `minimum_stock` do payload da Takeat para alerta de reposição.
- **Feitoria Coins.**
