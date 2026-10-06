# NR-1 psicossocial — o que foi construído e o que só você pode fazer

_Escrito em 29/09/2026. Não sou advogado nem técnico de segurança do trabalho; o que está aqui é engenharia em cima do que a norma pede, com as fontes citadas. A avaliação de risco e o PGR são responsabilidade de quem assina por eles._

## Onde a lei está hoje, e por que isso muda o tom

A NR-1 com riscos psicossociais entrou em vigor em **26/05/2026** (Portaria MTE 1.419/2024, com o cronograma da Portaria 765/2025). Em **25/06/2026** o ministro André Mendonça, do STF, suspendeu por 90 dias o **efeito punitivo** de cinco itens da norma na ADPF 1.316 (com as ADPF 1.333 e 1.340 apensadas), abrindo conciliação. O prazo venceria em 23/09 e foi **prorrogado por mais 90 dias em 24/09/2026** — ou seja, até perto de 23/12/2026 não cabe multa por esses itens.

Três coisas que essa suspensão **não** faz, e que são a razão de construir isto agora:

1. **A norma continua em vigor.** O que está suspenso é a multa, não o dever de identificar, avaliar e controlar o risco. O fiscal pode pedir o PGR atualizado.
2. **Reclamação trabalhista não passa pelo STF.** Se alguém alegar adoecimento por sobrecarga ou assédio, o que vale é a prova. Empresa sem registro de risco, sem plano e sem canal chega na audiência sem nada para mostrar — exatamente a mesma lógica da Súmula 338 no controle de jornada, que é a razão do módulo de ponto existir.
3. **A prorrogação pode não ter uma terceira.** Construir em dezembro, às pressas, com data retroativa, produz documento que não convence ninguém. Construir agora produz histórico com datas reais.

Fontes: [contábeis](https://www.contabeis.com.br/noticias/79637/nr-1-empresas-voltam-a-ter-risco-de-multas/), [RS Data](https://www.rsdata.com.br/nr1-fim-suspensao-penalidades-prorrogacao-stf/), [TAGD Advogados](https://tagdlaw.com.br/prazo-de-suspensao-fixado-pelo-stf-termina-e-sancoes-da-nr-1-podem-voltar-a-valer/), [Correio da Manhã](https://www.correiodamanha.com.br/politica/2026/09/322130-stf-prorroga-por-90-dias-suspensao-de-multas-da-nr-1.html).

## O que a norma pede, e onde cada pedaço mora agora

| O que a NR-1 pede | Onde está |
|---|---|
| Inventário de risco psicossocial | Tabela `nr1_riscos`, aba **NR-1** da gestão |
| Plano de ação com responsável e prazo | Mesmas linhas: `medidas`, `responsavel`, `prazo`, `situacao` |
| Prova de que a equipe foi informada | Tela pública `nr1.html` + os informativos em `nr1_informativos` |
| Canal de relato | Os recados da tela de operação, com dois assuntos psicossociais novos |
| Registro de que o risco foi reavaliado | Versionamento: revisão entra como linha nova apontando para a anterior |

Nada de tabela nova para o canal: ele já existia e já tinha modo anônimo. Ganhou dois assuntos — **sobrecarga ou pressão** e **assédio ou conduta de alguém** — e o painel da gestão conta quantos relatos chegaram por eles. Esse número é o sinal de que o canal está vivo; canal que nunca recebe nada não é prova de casa saudável, é prova de que ninguém confia nele.

## Decisões de desenho que valem explicar

**Risco não é editado por cima.** O banco recusa `UPDATE` e `DELETE` em `nr1_riscos`. Corrigir gera linha nova com `substitui` apontando para a anterior, e o risco "atual" é aquele que ninguém substituiu (`vw_nr1_riscos_atuais`). Um índice único em `substitui` impede duas revisões da mesma linha. Isso existe para uma cena específica: um ano depois, mostrar o que a casa sabia em maio, o que decidiu em junho e o que já estava feito em setembro — com as datas que o banco gravou, não com as que alguém escreveu depois.

**A tela da equipe não mostra nota de risco.** Ela mostra o fator e o que a casa vai fazer. Severidade 4 × chance 4 = 16 é ferramenta de gestão para ordenar fila; jogado na parede, assusta e não ajuda ninguém a trabalhar melhor. Os números ficam na aba da gestão.

**A tela pública não pede senha.** Informação de segurança trancada atrás de login é informação que ninguém lê, e a norma pede comunicação, não arquivo. O que exige identificação é **assinar** um relato — e aí o PIN entra na hora, com o mesmo limite de tentativas do ponto.

**Há um interruptor por risco (`mostrar_na_tela`).** Serve para um caso só: quando o texto do risco expõe uma pessoa. A saída certa é reescrever o fator sem nome e voltar a mostrar; deixar escondido é registrar para o fiscal e esconder de quem convive com o risco.

**O canal dá retorno honesto sobre o que o anonimato custa.** A tela diz, antes de a pessoa escolher: assinado, a gestão pode te responder; anônimo, ninguém consegue. Não é letra miúda — é a diferença entre um canal que resolve casos e um que só coleta reclamação.

## O que já está no ar

- Migration `nr1_riscos_informativos_e_canal`: as duas tabelas, o gatilho que barra edição, a view do risco atual, RLS ligada com zero policy para `anon`, e os dois assuntos novos no canal.
- Função `operacao` v2: ação pública `nr1`, e `nr1_painel`, `nr1_risco`, `nr1_informativo` atrás de login de dono ou gerente.
- `nr1.html`: a tela pública. Testada em Chromium a 360, 390 e 768 px, sem estouro horizontal, com envio anônimo e assinado funcionando.
- Aba **NR-1** na gestão: inventário, formulário de risco e revisão, editor de informativos, três contadores (riscos no inventário, ações com prazo vencido, relatos pelo canal) e o link público pronto para copiar.
- Cinco informativos já publicados, escritos para serem lidos por quem trabalha no salão: por que a página existe, o que a casa assume como compromisso, como usar o canal, o que fazer quando o aperto é agora, e o que acontece com o sigilo.

O que eu testei foi a parte pública e a mecânica. **As ações de gestão dependem de login e não consegui exercitar daqui** — confira ao abrir a aba pela primeira vez.

## O que só você pode fazer

**O inventário está vazio, e isso é de propósito.** Eu não vou inventar os riscos da sua casa: risco inventado por mim, listado num registro legal com a sua assinatura, é pior que registro vazio. O que eu posso fazer é dar o ponto de partida — abaixo estão os fatores que a literatura de NR-1 aponta para bar e restaurante e que conversam com o que você já me contou. **Cada um precisa passar pelo seu crivo antes de entrar**, e a medida tem que ser algo que a casa vá cumprir de verdade; ação escrita e não cumprida é prova contra, não a favor.

| Fator candidato | O que costuma ser a medida | O que eu já sei da sua casa |
|---|---|---|
| Noite de pico com gente insuficiente no salão | Piso mínimo de pessoas por turno de pico | Você escala freela por turno; a escala hoje é planilha |
| Jornada terminando de madrugada, com deslocamento | Transporte ou combinação de saída; escala publicada com antecedência | O dia operacional fecha às 01:00, então isso é rotina, não exceção |
| Cliente alterado ou desrespeitoso | Protocolo escrito: quem atende chama a gestão e sai de perto | Nada registrado ainda |
| Pressão de tempo na cozinha em horário de pico | Mise en place e pedido travado em horário crítico | Os checklists K01–K17 tocam nisso |
| Escala avisada em cima da hora | Publicar com prazo fixo | A publicação de escala já existe na tela de operação |
| Conduta de encarregado ou de colega | Canal, apuração e consequência escritas | O canal está no ar |
| Acúmulo de função | Descrição de função clara | As fichas de RH têm cargo e jornada |
| Hora extra e folga trabalhada | Pagamento em folha, sem banco de horas | **Decisão sua, de 25/09**: tudo é pago ou descontado |

**E fora do sistema:** quem assina o PGR precisa incorporar esses riscos ao documento. A NR-1 aceita, para grau de risco 1 e 2, que o PGR seja dispensado com declaração formal — mas a gestão do risco psicossocial não é dispensada, e um restaurante raramente está nesses graus. Vale uma conversa com o seu SESMT ou com quem faz o PGR da casa, mostrando esta tela: é mais fácil incorporar um inventário que já existe do que começar do zero na sala dele.

## O que eu ainda não fiz aqui

- **Registro de treinamento de liderança.** A norma cobra, e isso encaixa no módulo de treinamentos, que ainda vai ser construído — o perfil `treinamentos` do portal já existe esperando.
- **Instrumento validado de avaliação** (COPSOQ, JCQ). Aparece na literatura como o jeito correto de medir, e é decisão de quem assina o PGR, não minha. O inventário aqui aceita o resultado de qualquer método.
- **Indicador de acompanhamento ao longo do tempo.** Hoje o painel mostra o retrato de agora. Série histórica só faz sentido depois que houver histórico.
