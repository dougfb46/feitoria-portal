# Portal da gestão — o desenho integral

_Escrito em 01/10/2026, depois da decisão do Douglas: "as aprovações e publicações e folha é na página do gestor no portal"._

## O princípio que organiza o resto

**Agente prepara, gestor aprova, portal publica.**

Tudo que vem de fora — a folha que a contabilidade manda por e-mail, a escala montada na planilha do Drive, um documento largado numa pasta, um checklist que precisa de revisão — entra como **pendência** numa fila. Nada é publicado por robô em nome do gestor. A tela da gestão é onde se decide, e a decisão fica registrada com autor e horário.

Isso resolve de uma vez a tensão que apareceu quando falamos de automação: dá para automatizar a parte chata (ler, separar, casar nomes, montar texto) sem automatizar a parte que tem consequência (publicar um documento que alguém vai assinar).

A fila é a tabela `aprovacoes_pendentes`. Ela tem tipo, título, resumo, a carga que o agente preparou e uma referência que impede a mesma pendência de nascer duas vezes.

## As quatro frentes

### 1. Fila de aprovação e a casa da gestão

A aba inicial do `gestao.html` deixa de ser a Equipe e passa a ser **o que precisa de você hoje**: pendências de ponto, recados abertos, documentos esperando assinatura, ações de NR-1 vencidas, checklists reprovados, e a fila dos agentes. Um lugar só.

### 2. Checklists K01–K17

Construído no banco em 01/10 (migration `checklists_e_fila_de_aprovacao`). Quatro tabelas:

| Tabela | Para quê |
|---|---|
| `checklist_modelos` | o modelo, **versionado**. Importar de novo cria versão nova e desativa a anterior |
| `checklist_execucoes` | uma execução por turno, com nota, justificativa e situação |
| `checklist_respostas` | **append-only**: correção entra como linha nova apontando para a anterior |
| `checklist_ocorrencias` | não conformidade vira ocorrência com responsável e prazo |

Duas garantias testadas em produção no dia da criação:

- `update` numa resposta é recusado pelo banco: *"Resposta de checklist nao e editada nem apagada. Registre uma correcao apontando para esta em corrige."*
- A correção entra como linha nova; `vw_checklist_respostas_atuais` devolve só a que vale, e o histórico fica com as duas.

É isso que atende ao pedido de **"corrigir e validar a operação, com forma de reenviar as correções mais pra frente"**: o modelo pode mudar sem reescrever o que já foi feito, e a resposta pode ser corrigida sem apagar o que foi respondido na hora.

Falta: a Edge Function, a tela de execução (celular, com PIN) e o painel.

### 3. Painel dos checklists

O que ele precisa responder, em ordem de importância:

1. **O que não está conforme agora** — itens críticos reprovados, com responsável e prazo.
2. **O que não foi feito** — turno sem checklist é tão informativo quanto checklist com item reprovado.
3. **Onde repete** — o mesmo item falhando toda semana é problema de processo, não de pessoa.
4. **Nota por bloco ao longo do tempo** — só depois que houver histórico; antes disso é gráfico bonito sem conteúdo.

### 4. Drive: caixa de entrada e backup

**Backup.** Hoje, se o Supabase sumir, os documentos assinados vão junto. Espelhar o bucket numa pasta do Drive resolve — com um aviso que não é detalhe: ali dentro tem ficha de registro com CPF, filiação e endereço, além dos holerites. A pasta de backup é só do Douglas, nunca compartilhada com a equipe.

**Entrada.** Uma pasta "Para publicar" que o portal lê, cria a pendência na fila, e o gestor aprova. O arquivo é copiado para o bucket na aprovação, e **é a cópia do bucket que carrega o hash da assinatura**. O Drive é caixa de entrada, não cofre: se alguém editar o arquivo no Drive depois, a assinatura não bate — e isso é o sistema funcionando.

**Como o servidor enxerga o Drive.** Não com a conta Google do Douglas. Com uma **conta de serviço**, e compartilhando com ela só as duas pastas. Assim o servidor vê aquelas pastas e nada mais. A chave vive no Vault.

## Escala: duas coisas diferentes

Decisão do Douglas em 01/10:

- **Equipe fixa**: só interessa a **folga de domingo do mês**. O resto da jornada já está na grade do ponto. Texto curto, publicado uma vez por mês.
- **Freelas**: interessa **quem trabalha em qual função**, para o atendente saber quem responde por cada ponto do salão. Sai pronto da aba FUNÇÃO da planilha, pelo "colar da planilha".

Para ligar isso ao mapa falta um de-para que **não dá para deduzir**: as funções da planilha (tijolinho, chalé alto, chalé baixo/apoio copos, recepção jardim/gradil, boqueta/amoreira e prox, bar, chopeira, atendimento geral) contra as áreas do mapa (Chalé, Central, Jardim, Salão externo, Deck) — que também foram deduzidas do cartaz e já estavam marcadas para conferência. Com o de-para, tocar numa mesa mostra quem responde por ela hoje.

## Ordem de construção

1. Edge Function e tela de execução dos checklists — sem execução não há painel.
2. Painel dos checklists na gestão.
3. Fila de aprovação na tela da gestão, com a folha entrando por ela.
4. Agente semanal da escala (lê a planilha, cria a pendência).
5. Agente mensal da folha (lê o e-mail, separa, cria a pendência).
6. Backup no Drive.
7. Pasta de entrada no Drive.

Os itens 4 a 7 dependem da fila existir. Os itens 6 e 7 dependem da conta de serviço.

## O que fica registrado como dívida

- O modelo de teste `K99` ficou no banco, desativado: as tabelas são append-only e apagar exigiria desligar o gatilho de proteção. Está marcado como teste e não aparece em lugar nenhum.
- A limpeza dos dados de teste antigos (`Teste Cozinha` e companhia) continua pendente e agora tem um item a mais.
