# AGENTS.md — Portal de Gestão da Feitoria da Cerveja

Leia este arquivo inteiro antes de escrever a primeira linha. Ele não é documentação
de cortesia: cada regra aqui existe porque alguma coisa deu errado antes, ou porque
o sistema guarda prova que pode ser usada contra a empresa num processo trabalhista.

## Quem é o dono do projeto

Douglas Fabris Barbosa, sócio e gestor do PUB. **Não é programador.** Fale em
português simples, assuma as decisões técnicas reversíveis você mesmo e explique só
o que ele precisa ver ou decidir. Não devolva stack trace, não devolva diff bruto,
não peça para ele "rodar o comando e colar a saída" quando você mesmo pode rodar.

## O que é este sistema

Portal de gestão de um pub em Mogi das Cruzes/SP, duas unidades (PUB Mogi é a
principal). Cobre ponto, checklists operacionais, documentos com assinatura,
folha do mês, escala, validade de produtos, contagem de estoque, NR-1 e uma tela de
consulta para a equipe no salão. Integra a API da Takeat (PDV) para catálogo,
vendas e financeiro.

Público: ~7 CLT e ~28 freelas cadastrados. As telas da equipe são usadas **no
celular, no meio do turno, no wi-fi do pub**. Isso é um requisito de arquitetura, não
um detalhe: ver "Por que HTML estático" abaixo.

## Arquitetura

```
Navegador (GitHub Pages)  ──►  Edge Function (Supabase)  ──►  API da Takeat
   HTML estático, sem chave        guarda os segredos          public-api.takeat.app
                                          │
                                          ▼
                                   Postgres (Supabase)
```

- **Supabase** `portal-feitoria`, ref `kujelbcbrcmkitzyswbh`, região sa-east-1,
  **plano gratuito — o projeto pausa depois de ~7 dias sem uso.** Se as functions
  começarem a dar erro sem motivo, confira se o projeto não está pausado.
- **Frontend**: HTML estático no GitHub Pages, repositório `dougfb46/feitoria-portal`.
- **Tela da cozinha (etiquetas)**: repositório **separado**,
  `dougfb46/feitoria-etiquetas`. Está **em produção na cozinha**. Não mexa sem
  necessidade explícita.

### Por que HTML estático, e não React

As telas da equipe hoje têm entre 10 KB e 23 KB. Um app React + Tailwind carrega
300–600 KB de JavaScript antes de qualquer conteúdo. Para alguém abrindo o checklist
no celular com a mão molhada no meio do turno, isso é a diferença entre abrir na hora
e desistir. **Não proponha reescrever as telas da equipe em framework.** A tela de
gestão (`web/gestao.html`, 131 KB, desktop, usada só pelo dono e gerentes) é a única
candidata legítima a um framework, e mesmo ela só depois que o módulo de checklist
rodar um turno real.

### Por que Edge Function só devolve JSON

O gateway deste projeto **descarta o `content-type`**. HTML servido por Edge Function
aparece como código-fonte no navegador. Isso foi testado e confirmado. **Não tente
de novo.** Página mora no GitHub Pages; function devolve JSON.

## Regras que não se negociam

### 1. Nada é editado por cima

Tabelas de registro são **append-only**, com trigger no banco **recusando UPDATE e
DELETE**. Correção entra como **linha nova** apontando para a anterior (`corrige`,
`substitui`), com autor, horário e motivo. Vale a última; o histórico fica inteiro.
Item que sai de uso vira `active = false`, nunca `DELETE`.

Há índice único impedindo duas correções da mesma linha
(`checklist_respostas_corrige_unico`, `nr1_riscos_substitui_unico`). Se o insert
falhar com esse nome, a resposta certa para o usuário é "recarregue a tela", não
tentar de novo.

**Por que:** o registro existe como prova a favor da empresa. Sem registro, numa
reclamação trabalhista vale a jornada que o empregado alegar (Súmula 338 do TST).
Registro que pode ser editado por cima não vale como prova.

### 2. RLS em tudo, zero policies para `anon`

Toda tabela tem RLS ligada. **Nenhuma tabela tem policy para o papel `anon`.** Tela
pública não fala com o Postgres: fala com Edge Function, que usa `service_role` e faz
a autorização ação por ação, dentro do código.

Papéis vivem em tabela própria (`user_roles`) com função security definer `has_role`.
**Nunca** coloque papel dentro da tabela de perfis.

### 3. Fuso único e dia operacional às 01:30

Tudo em `America/Sao_Paulo`. **O dia operacional do PUB fecha às 01:30** — venda ou
turno depois da meia-noite pertence ao dia anterior. Confirmado no banco em 06/10/2026:
`public.dia_da_baixa` subtrai `interval '1 hour 30 minutes'` antes de truncar para data,
e `public.data_operacional` só a chama. **Vários documentos do projeto dizem 01:00 —
estão errados.** Vale o banco. Guarde timestamp em UTC e derive
`business_date` **no servidor**, sempre pela função `public.data_operacional(p_ts)`.
Nunca calcule dia operacional no navegador.

### 4. Segredos

- A API key da Takeat **nunca** chega ao navegador. Vive como segredo no painel do
  Supabase (Edge Functions › Secrets) e é usada só por Edge Function.
- **Nada de `VITE_*` com segredo.** Variável que o build injeta no bundle é pública.
- No repositório só existe `.env.example`, com nomes e valores fictícios.
- **Nunca peça ao Douglas para colar no chat** API key, token, senha, código OAuth ou
  `code_verifier`. Nunca abra nem reproduza um `.env`.

### 5. Dados pessoais

Chaves Pix (CPF, CNPJ, telefone, e-mail) ficam em tabela separada com acesso
restrito, fora de telas de operação, relatórios e logs. A tabela `pin_tentativas`
**nunca guarda o PIN tentado** — só o resultado, o IP e a origem.

Recado anônimo na tela de operação **não guarda autor, aparelho nem IP** — e também
não guarda isso no caminho assinado, para as duas colunas terem o mesmo formato e o
anônimo não se denunciar por ser o único sem metadado. Isso não é descuido, é a
promessa feita à equipe.

### 6. Limite de tentativas de PIN

Todo caminho que aceita PIN passa por
`verificar_pin_limitado(_restaurant_id, _pin, _ip, _origem, _teto, _janela_min)`,
que devolve `{status: ok|errado|bloqueado, employee_id, restam, espera_min}`. Padrão:
15 tentativas em 10 minutos. Segundo fator (data de nascimento, no portal do
colaborador) conta no **mesmo** contador — senão o teto é contornável.

### 7. Nunca invente número

Item de checklist que depende de limite numérico e não tem limite cadastrado é
**aceito, marcado, e aparece no painel da gestão como pendente de cadastro**. Melhor
registrar que o número não existe do que fingir um. A mesma regra vale para qualquer
dado vindo da Takeat: campo ausente é ausente, não é zero.

## A integração com a Takeat

Fonte da verdade: `docs.takeat.app/llms.txt` e os `.md` de cada operação.
**Não invente endpoint, campo, escopo nem comportamento.** Quando faltar informação,
diga exatamente o que não foi possível confirmar.

- Base `https://public-api.takeat.app`. API key `tk_test_` ou `tk_live_` gerada no
  AI Builders, trocada em `POST /oauth/token` (`grant_type=api_key`,
  form-urlencoded).
- Access token vale 900 s. **O refresh token é de uso único: reusar revoga a família
  inteira.** A rotação é serializada por estado no banco
  (`takeat_begin_rotation` / `commit` / `fail` / `release`). **Não troque por lock de
  transação** — uma Edge Function não mantém transação aberta entre as chamadas HTTP
  que a rotação exige; o lock morreria no meio.
- Limites: **10 req/min e 500/dia por chave**. O cliente HTTP espaça 6,5 s entre
  chamadas, o que mantém o ritmo abaixo do teto por construção. No 429, respeite o
  `Retry-After`.
- **Não existe identificador de insumo nem de intermediário na API** — confirmado
  contra a API em 22/09 e reconfirmado em 24/09. A chave do catálogo é o **nome
  normalizado** (`name_key`). Dois insumos têm nome repetido na Takeat e colapsam num
  registro só; a sincronização **relata** os nomes repetidos em vez de esconder.
  Consequência: se alguém renomear um insumo na Takeat, a sincronização seguinte trata
  como item novo e o produto de etiqueta que apontava para o antigo fica órfão em
  silêncio.
- Janelas máximas: `/v1/table-sessions` **3 dias + fração**;
  `/v1/financial/cash-flows` **92 dias**.
- **Não há webhook publicado.** Tudo é polling. Não tente simular com polling
  agressivo — o teto diário é 500.
- A chave em uso hoje é `tk_test_`, e **chave de teste lê dados reais de produção**
  (`/md/v1/autenticacao.md`). Não existe ambiente fictício. Os números são de verdade.

### MCP da Takeat é outra coisa

Existe um servidor MCP oficial em `https://public-api.takeat.app/mcp`, OAuth 2.1,
**somente leitura**, 60 req/min e 5.000/dia. Serve para um assistente de IA consultar
dados e a documentação — **não substitui a autenticação REST do portal**. Chave REST
(`tk_live_`/`tk_test_`) não funciona no MCP, e chave MCP (`tk_mcp_live_...`) não
funciona nas rotas REST. São famílias de credencial diferentes.

## Como trabalhar neste repositório

### Primeira coisa a fazer, antes de qualquer alteração

O repositório **não tem** a cópia completa do que está no ar. No ar existem **21 Edge
Functions** e **54 migrations aplicadas**; o repositório carrega uma fração. Puxe o
estado real antes de mexer em qualquer coisa:

```bash
supabase login                                  # Douglas gera o token no painel
supabase link --project-ref kujelbcbrcmkitzyswbh
supabase functions download <slug>              # uma por vez, lista em docs/mapa-do-sistema.md
supabase db pull                                # gera a migration com o schema atual
```

Trabalhar a partir do repositório sem fazer isso é trabalhar a partir de uma foto
velha, e foi assim que a divergência apareceu.

### Verificações

- `deno task check` — tipos.
- `deno task test` — as 9 verificações do ciclo de tokens. **Os testes sobem um
  servidor falso e não falam com a Takeat.** Passar nos testes não é validação da
  integração real.

### Deploy

Functions e migrations pelo painel do Supabase ou pela CLI. Toda migration vai para
`supabase/migrations/` com data no nome. As telas vão para o GitHub Pages pelo
repositório.

Quando o shell não alcançar o domínio do Supabase, dá para disparar uma Edge Function
de dentro do banco:

```sql
select net.http_post(
  url := 'https://kujelbcbrcmkitzyswbh.supabase.co/functions/v1/<slug>',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <anon>'),
  body := '{}'::jsonb, timeout_milliseconds := 60000);
-- resposta em net._http_response
```

Existem helpers para isso: `public.chamar_ponto`, `chamar_portal`, `chamar_operacao`,
`chamar_checklists`.

### Ritmo

Faça uma coisa de cada vez e teste antes de seguir. Três chamadas simultâneas à mesma
Edge Function em cold start fazem uma delas falhar na primeira consulta ao banco — o
código degrada certo ("instabilidade momentânea", nunca "PIN incorreto"), mas não
dispare em paralelo de propósito.

## Como dois agentes dividem este projeto

Este projeto é tocado pelo Claude (aqui, no chat) e pelo Codex (no terminal, sobre o
repositório). **Eles não se falam.** Não existe canal entre os dois. O que existe é
estado compartilhado, e são quatro bases:

1. **O repositório Git** — o código e as telas.
2. **O Supabase** `kujelbcbrcmkitzyswbh` — o estado vivo.
3. **Este `AGENTS.md`** — as regras.
4. **`docs/diario.md`** — o recado para o próximo. É o que substitui a conversa.

### As três regras do trabalho conjunto

**Um escritor por vez, por arquivo.** Nunca deixe o Claude editando `web/gestao.html`
aqui enquanto o Codex edita o mesmo arquivo lá. Um dos dois perde o trabalho, e o
perdedor costuma ser quem salvou primeiro.

**`git pull` antes de começar, commit e push ao terminar.** Trabalho não commitado num
lado enquanto o outro começa é a receita da divergência que já aconteceu uma vez neste
projeto (ver `docs/mapa-do-sistema.md`).

**Escreva no diário antes de encerrar.** Cinco linhas. O que não estiver escrito não
chega ao próximo.

### Divisão que funciona

| | Faz |
|---|---|
| **Codex** | edição de código, migrations, deploy, rodar os testes, a CLI do Supabase |
| **Claude** | ler o banco, decidir arquitetura, documentos, contexto legal e operacional, revisar o que o Codex fez |

Nada impede o contrário — mas cada um está onde tem ferramenta melhor.

### Publicação

O repositório publica um site em produção pelo GitHub Pages. **Trabalhe em branch e
abra PR; não empurre direto na `main`.** Push na `main` vai ao ar na hora, e quem usa
é a equipe no meio do turno.

## O que está pendente (06/10/2026)

Defeito real:

- **`av-qtd` no repositório de etiquetas** — único defeito conhecido que **corrompe
  dado**. Prioridade sobre qualquer coisa nova.

Operacional, depende do Douglas:

- 3 dos 4 CLT ainda não têm PIN cadastrado.
- `web/contagem.html` **não existe neste repositório** e nunca foi publicada.
- Valéria não cadastrada; Kely Fogaça com cadastro incompleto.
- 8 riscos de NR-1 estão gravados com `mostrar_na_tela = false`, esperando revisão.
- Checklist K01 nunca rodou num turno real.
- 21 dos 23 modelos de RH ainda não foram importados.
- Dois registros de teste sobraram em `checklist_respostas` (K99, execução reprovada).
  A limpeza com `delete` largo foi bloqueada; os triggers foram reabilitados e
  conferidos (`tgenabled = 'O'`).

Esperando terceiros:

- Contador: qual CCT depois da notificação do SINTHORESP, e os percentuais 50/60/20.
- Advogado: minuta de LGPD, revisão dos 23 modelos de RH (o modelo 06 tem erros que
  vieram do documento original).
- Quem assina o PGR: incorporar o inventário psicossocial.

## Contexto legal que afeta decisões

- **NR-1 psicossocial** em vigor desde 26/05/2026 (Portaria MTE 1.419/2024, cronograma
  da Portaria 765/2025).
- O STF (ADPF 1.316, Min. André Mendonça) **suspendeu o efeito punitivo** de cinco
  itens em 25/06/2026 e **prorrogou por mais 90 dias em 24/09/2026**. Ou seja: não há
  multa até aproximadamente 23/12/2026, mas **a obrigação de gerenciar continua** — e
  uma reclamação trabalhista não depende da suspensão.
- Abaixo de 20 empregados **não há obrigação legal de controle de jornada**
  (art. 74 §2 da CLT). Sem obrigação, não há AFD, INPI, ICP-Brasil nem REP-P. O ponto
  existe como prova a favor da empresa, e é por isso que precisa ser difícil de
  adulterar.
- Há reclamação do SINTHORESP ativa. Documento que o empregado assina com valor
  divergente vira prova contra a empresa. **Não gere holerite a partir de campos
  extraídos de PDF** — os valores são resultado declarado ao eSocial, DARF e FGTS; um
  centavo de divergência é um problema jurídico, não um bug.

## Coisas que já foram testadas e não funcionam

Não repita:

- Edge Function servindo HTML (o gateway descarta o `content-type`).
- Recortar PDF por MediaBox ou por `embedPage` com bounding box para separar dois
  recibos empilhados numa página: **o conteúdo do vizinho continua dentro do arquivo**.
  Verificado com pdfplumber nas duas abordagens. Redação de verdade exige
  MuPDF/PyMuPDF, que é **AGPL**. A solução adotada foi ler os campos e reemitir o
  recibo com a Feitoria como emitente.
- Arredondar a altura dos itens de texto do pdf.js para agrupar linhas: o gerador do
  PDF varia meio ponto dentro da mesma linha da tabela, e o arredondamento partia a
  linha em duas. Use agrupamento por proximidade (tolerância de 2 pt).
- Lock de transação para serializar a rotação do refresh token da Takeat.
