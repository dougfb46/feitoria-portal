# Revisão de 28/09 — o que eu conferi, e o veredicto de cada achado

_Escrito em 28/09/2026, atualizado em 29/09. Confere o relatório `feitoria-revisao-e-plano-de-execucao.md` (24 achados, 36 tarefas, E0–E5) contra o código publicado e contra o banco de produção._

## O que eu tinha que o revisor não tinha

O relatório diz, com honestidade, que **o backend não está versionado no GitHub** e que por isso vários P0 são hipóteses sobre o servidor, não defeitos observados. Eu tenho acesso ao banco e às Edge Functions. É aí que esta conferência acrescenta algo: ela fecha as perguntas que ficaram abertas, em vez de repetir as que já estavam respondidas.

**Os dois commits que o revisor usou ainda são o topo dos dois repositórios** — portal `d737471`, etiquetas `5a71a2b`. Conferido pela API do GitHub em 28/09. Nada foi corrigido por deriva de código entre a revisão e agora: todo achado que ele descreveu continuava de pé.

## Veredictos

### Confirmados no código, com a linha na mão

| Achado | Veredicto | Evidência |
|---|---|---|
| A01 `av-qtd` duplicado | **Confirmado, e pior do que descrito** | O `id` está em dois inputs; `getElementById` devolve o primeiro (contador de etiquetas, `min=1 max=20`) e esse valor é enviado como `medida_qtd`. Ou seja: a quantidade da porção gravada é o **número de etiquetas**. Imprimir 3 etiquetas de 0,250 kg grava 3. Isso contamina a quantidade no relatório de perdas e sobras |
| A02 agrupamento por nome | Confirmado | `gestao.html:649`, `porPessoa.get(m.nome)`. O mesmo arquivo agrupa a escala por `employee_id` na linha 876 — inconsistência interna |
| A03 data civil recua um dia | Confirmado, e **escopo fechado** | `portal.html:69`. Dos quatro campos que passam por `dataBR`, só `documents.prazo` e `documents.data_documento` são `date` no banco; `created_at` e `signed_at` são `timestamptz` e estavam certos. O bug morde exatamente o prazo |
| A04 temporizador órfão | Confirmado | `ponto.html:280`, `setTimeout` sem handle e sem cancelamento. Tocar em "Pronto" não cancelava: 12 s depois o tablet derrubava o atendimento da pessoa seguinte |
| A05 câmera e inatividade | Confirmado | `parar()` era local à tela de foto; o encerramento por inatividade (linha 118) trocava a tela sem chamá-lo |
| A07 JSON em atributo HTML | Confirmado | 11 usos de `JSON.stringify` dentro de atributo com aspas simples. Um sobrenome como D'Alessandro quebra o atributo |
| A09 PIN visível | Confirmado | `portal.html`, dois campos de PIN sem `type=password`. A expressão "segundo fator" também estava errada: PIN e nascimento são dois dados que a pessoa sabe |
| A13 origem imprecisa | Confirmado | `gestao.html:673` imprimia "tablet" para tudo que não era da gestão, e desde 24/09 existe marcação por celular |
| A15 troca de unidade | Confirmado | O `onchange` chamava só `render()`; filtro de pessoa, período da folha, dia escolhido e o selo de pendências continuavam da unidade anterior |
| A16 dia operacional no navegador | Confirmado | `gestao.html:73`. O servidor tem `public.data_operacional`; a tela calculava em paralelo, com o fuso do aparelho |

### Corrigidos com nuance

**A06 — reenvio de marcação.** O front não travava, isso é verdade. Mas o servidor **já** tinha uma janela de 60 segundos que recusava marcação repetida, então duplicata nunca foi criada. O defeito real era outro e mais chato: a retentativa depois de um timeout recebia um erro seco ("espere um minuto") em vez do resultado que já estava gravado, então a pessoa tentava de novo achando que não tinha registrado. Corrigido devolvendo a marcação existente com `ja_registrada: true`.

**A08 — proteção depende de backend não versionado.** Aqui a conferência muda o quadro. O que **está** certo: `verificar_pin` não é executável por `anon` nem por `authenticated` — só pelo service_role, dentro das funções; **nenhuma policy de RLS concede acesso a `anon`**, então o navegador com a chave pública não lê tabela alguma; toda função de gestão confere papel e unidade; o portal exige PIN + nascimento + vínculo de aparelho e o perfil é checado antes de vincular aparelho. O teste que o revisor propôs em B07 — chamar direto sem permissão — passa.

O que **estava errado, e ele não podia ver:** não havia limite nenhum de tentativas de PIN. A função `ponto` é pública por desenho (o tablet não tem login) e o token da unidade viaja na URL. Com PIN de 4 dígitos, varrer 10.000 combinações era trivial — e com o PIN certo em mãos dá para bater ponto no lugar de outra pessoa. **Esse era o furo mais sério do sistema**, mais do que qualquer item da lista de 24. Corrigido.

**A14 — escala depende de `registra_ponto`.** Tecnicamente confirmado: a tela filtra por esse campo. Mas a premissa do achado caiu por decisão do Douglas em 25/09 — freela está **fora da escala, do ponto e da folha de propósito**, e isso continua na planilha. Então isto não é defeito a corrigir; é escopo a registrar. Se um dia o freela entrar na escala, o campo separado que o relatório propõe é o caminho certo.

### Não conferidos ainda

A10, A11, A12 (UX, contraste, acessibilidade) — os cálculos de contraste do relatório são verificáveis e eu não os refiz. A17 a A24 estão no repositório de etiquetas, que não tenho localmente; confirmei só o A01 por leitura do arquivo publicado. O checklist impresso, os dez prints e o manual NR-1 não vieram nesta conversa.

## O que já está corrigido e no ar

**No banco e nas funções:**

- `pin_tentativas` + `verificar_pin_limitado`: teto de 15 erros por IP e unidade em 10 minutos, com log de cada tentativa (nunca do PIN tentado). O número é folgado para quem erra de verdade e apertado para varredura — nesse ritmo, exaurir 10.000 PINs levaria mais de 100 dias. Mensagem própria, sem revelar se o PIN existe. **Ligado nas funções `ponto` e `portal`** (a `portal` em 29/09, versão 5).
- No `portal`, a **data de nascimento também conta como tentativa errada**. Isso não estava no relatório; apareceu ao ligar o limite. O contador ficava no PIN, então quem acertasse o PIN teria tentativas infinitas no segundo dado — que tem poucas combinações plausíveis. Agora os dois erros caem no mesmo teto. Testado: PIN certo com nascimento errado grava falha; com 15 falhas acumuladas, a resposta passa a ser "Muitas tentativas erradas. Espere 10 minutos e tente de novo."
- Cuidado deliberado: no salão todos compartilham o mesmo IP. Teto baixo bloquearia a equipe por causa de uma pessoa. Se o limite incomodar na prática, os dois números são parâmetros da função.
- `gestao-equipe` passa a devolver o dia operacional do servidor e a origem real de cada marcação.
- Marcação lançada pela gestão agora grava `origem = 'gestor'`.

**Nas telas** (`ponto.html`, `portal.html`, `gestao.html`):

- Um único caminho de saída no tablet, que cancela temporizadores e desliga a câmera — A04 e A05.
- Agrupamento do ponto por `employee_id`, com o nome só como rótulo — A02.
- Data civil formatada sem conversão de fuso — A03.
- PIN oculto e a linguagem de "segundo fator" corrigida — A09.
- Origem real na tabela do dia — A13.
- Troca de unidade limpa filtros, período, dia e selo — A15.
- Dia operacional vindo do servidor, com o cálculo local só como último recurso — A16.
- Reenvio devolve a marcação já gravada — A06.
- Renderização segura — A07, detalhado abaixo.

## A07 — o passe de renderização segura (29/09)

Feito nas três telas que montam HTML a partir de dado do servidor: `gestao.html`, `ponto.html` e `portal.html`. A `operacao.html` já havia nascido usando só `textContent` e não precisou de mudança.

Duas ferramentas, em vez de reescrever tela por tela:

- **`esc()`** escapa `& < > " '` e passou a envolver toda interpolação que carrega dado — 116 pontos na gestão, 18 no ponto, 16 no portal. Ficaram de fora, de propósito, as interpolações de rótulo fixo, número e data, e os poucos trechos em que o HTML é intencional (o aviso de percentuais não confirmados, por exemplo).
- **`guarde()`** substitui os 11 `JSON.stringify` dentro de atributo. Antes o objeto inteiro ia como JSON num atributo delimitado por apóstrofo — um D'Alessandro quebrava o atributo e o botão sumia. Agora o atributo leva só um índice e o objeto fica em memória, em `CARGA`. A leitura virou `CARGA[b.dataset.x]` em vez de `JSON.parse`.

Também corrigi três lugares que **tentavam** escapar pela metade, trocando só as aspas duplas por `&quot;`: o campo da ficha e os dois campos das posições do turno.

**Como sei que funciona.** Montei a tela de gestão em Chromium de verdade, com um backend falso devolvendo um colaborador chamado `Ana "><img src=x onerror="window.INVADIU=1">' O'Brien <b>x</b>`. Na versão anterior o script **executou** — `window.INVADIU` virou 1, apareceu uma imagem na página — e o botão "editar" desapareceu, porque o apóstrofo partiu o atributo. Na versão nova: nada executou, nenhuma imagem, o nome apareceu como texto literal e o botão "editar" devolveu o objeto intacto ao formulário. Repeti o mesmo no ponto e no portal, com `<script>` no nome da unidade, no rótulo do botão, no título de um holerite e no aviso de pendência — todos vieram escapados, sem erro de página.

## O que ficou de fora deste pacote, e por quê

- **A01, A17 a A21** estão no repositório de etiquetas. Para o A01 a correção é de três linhas: renomear o segundo input para `av-medida-qtd`, ler esse id em `medida_qtd` e validar inteiro no contador e decimal na porção. Como não tenho o arquivo aqui, ou você me manda o `index.html` ou eu escrevo o patch para você aplicar.
- As ações de gestão da função `operacao` (tratar recado, posições do turno, publicar escala) estão no ar e **não foram testadas por mim**: exigem um usuário autenticado no navegador, que eu não consigo simular daqui. Vale exercitar na primeira vez que você abrir a aba Operação.

## Discordâncias do relatório que vale registrar

1. **"Confirmado" está misturado.** O próprio relatório avisa, mas vale repetir: A04 e A05 são leitura de fluxo, A06 e A08 dependiam do servidor, A07 e A15 são risco estático. Três dos nove P0 eram hipóteses — e uma delas (A06) estava parcialmente errada, enquanto A08 escondia um problema maior do que o descrito.
2. **A14 não é defeito**, é decisão registrada.
3. **A01 é mais grave do que o texto sugere** — não é ambiguidade de identificador, é quantidade errada gravada em todo registro de etiqueta avulsa.
4. **Alvo de toque:** o relatório cita 48 px como meta e 24 px como mínimo AA. Para homologação vale um número só; sugiro 44 px, que é o que o dedo pede num tablet de salão, e tratar 24 px como piso inegociável.

## Próximo passo que eu sugiro

Dos três itens que eu tinha apontado como bloqueio antes de E1 e do piloto de Coins, dois estão fechados: o limite de tentativas na `portal` e o passe do A07. Sobra o **`av-qtd`**, no repositório de etiquetas — é o único que ainda corrompe dado a cada uso. Depois dele, a base está limpa para o que vem: NR-1, treinamentos e checklists.
