# Prompt para gerar checklists e treinamentos em outra conversa

Cole o texto abaixo numa conversa nova, junto com o material técnico (POP, norma, manual do equipamento, ficha técnica, o que for). O resultado é um ou mais arquivos `.json` que você importa na tela de gestão do portal.

---

## Para um checklist

> Preciso que você converta o material anexo em um modelo de checklist para o Portal Feitoria, seguindo exatamente o contrato do arquivo `checklist.schema.json`, que também vai anexo. Use o `K01-abertura-geral.json` como exemplo de como o contrato fica preenchido na prática.
>
> Regras que não posso quebrar:
>
> - **Não invente número.** Limite de temperatura, pressão, tempo, valor de fundo de caixa: se o material não traz, deixe `limites: null` e `exige_cadastro: true`. Um número inventado num checklist sanitário é pior do que um campo vazio.
> - **`id` de item é estável.** Ele liga o histórico entre versões. Se o item já existe num modelo anterior, reuse o mesmo `id`.
> - **Crítico é o que machuca:** sanitário, segurança de pessoa ou dinheiro. Não marque tudo como crítico — se tudo é crítico, nada é.
> - **Item crítico não aceita "não aplicável".**
> - **Nada de instrução genérica que possa causar dano.** "Desligar os equipamentos" não pode existir solto: separe por equipamento, porque refrigeração não se desliga.
> - **Foto obrigatória só onde o material pede.** No resto, `foto_se_nao_conforme`.
> - Se o dado já é registrado em outro módulo (etiqueta, ponto, caixa, contagem), preencha `reaproveita` em vez de criar digitação duplicada.
>
> Devolva um arquivo `.json` por bloco, nomeado `K<numero>-<assunto>.json`, e no fim uma lista do que ficou pendente de decisão humana.

## Para um treinamento

> Preciso que você converta o material anexo em um treinamento para o Portal Feitoria, seguindo exatamente o contrato do arquivo `treinamento.schema.json`, que vai anexo. Use o `T01-identificacao-e-validade.json` como exemplo.
>
> Regras:
>
> - **Abrir conteúdo não é concluir.** Se o material não dá base para montar uma verificação de aprendizagem honesta, deixe `verificacao.usa: false`, `certificado.gera: false` e `coins: 0`, e me diga que aquilo é um comunicado, não um treinamento.
> - **Questão tem uma resposta certa e distratores plausíveis.** Alternativa obviamente absurda não verifica nada.
> - **Escreva o `retorno` de cada alternativa**, inclusive das erradas: é ali que a pessoa aprende.
> - **Fale como a operação fala.** Sem "colaborador deve proceder à higienização" — é "lave as mãos".
> - Preencha `referencias` com a norma ou o POP de origem. Se o conteúdo é decisão interna da casa e não norma, diga isso em vez de citar uma norma que não trata daquilo.
> - Não prometa validade jurídica nem conformidade por causa do certificado.
>
> Devolva `T<numero>-<assunto>.json` e, no fim, o que ficou em aberto.

---

## O que fazer com os arquivos

Tela de gestão → aba Documentos → **Importar modelos**, e escolha os `.json`. Cada importação cria versão nova e desativa a anterior. Execução já feita continua apontando para a versão que foi usada — é isso que deixa você corrigir e reenviar depois sem perder o histórico.

## Quando você quiser corrigir um checklist que já está rodando

Duas coisas diferentes, e vale não confundir:

**Corrigir o modelo** — o item estava mal escrito, faltava um item, o limite mudou. Gera versão nova do modelo. Execuções antigas ficam como estavam; as novas usam a versão nova.

**Corrigir uma execução** — a pessoa preencheu errado ou faltou evidência. A liderança devolve com o motivo, e a **mesma** execução volta para quem fez. Não nasce execução nova, não nasce crédito novo, e o histórico mostra que foi devolvida e corrigida.
