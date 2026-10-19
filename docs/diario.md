# Diário de publicação

## 16/10/2026 — Separação entre fontes privados e publicação
- Repositório público iniciado com histórico novo, contendo apenas as telas.
- Histórico anterior e documentação interna preservados no repositório privado.
- Removidos exemplos com nomes reais do HTML; URLs e comportamento preservados.
- Validação automática limita os arquivos permitidos e rejeita credenciais reconhecíveis.
- Próximo: desenvolver no privado e publicar somente arquivos revisados por PR.

## 18/10/2026 - Boletim do dono
Interface para análise do agente, vendas, custos e metas, com datas e fontes.
Consulta restrita ao dono e à unidade pelo serviço privado.
Histórico e indicadores não são incluídos nesta publicação estática.
Atualizar painel relê as fontes importadas; a tela informa seus períodos.
Acesso pela nova aba de Gestão; telas da equipe permanecem preservadas.

## 18/10/2026 - Histórico financeiro
Nova consulta por fonte, tipo e assunto/fornecedor, com paginação e exportação da página.
Histórico e relatórios permanecem em serviços privados, com autorização por unidade.
Visão do grupo e documentos sem unidade exigem papel de dono global.
A interface preserva a distinção entre cobrança, agendamento e confirmação.
Publicação contém somente telas; dados e documentos não são enviados a este repositório.

## 18/10/2026 - Navegação e atalhos
Gestão com visão geral, busca no menu, áreas agrupadas e descrições das tarefas.
Colaborador com atalhos da rotina e destaque para documentos pendentes.
Rotas raiz e web atualizadas; checklist da raiz aponta para web/checklist.html.
Verificados JavaScript, identificação integrada e navegação em prévia de 390 px.
Somente telas estáticas; sem dados reais, prévias fictícias ou alterações de backend.

## 19/10/2026 - Compras e recebimentos
Nova área em Operação com solicitações, aprovação e acompanhamento das entregas.
Permite preparar itens de uma nota fiscal e revisar referências de documentos.
Conferências parciais e histórico preservados; acesso validado no serviço privado.
Compras não envia pedidos ao fornecedor, paga ou altera estoque automaticamente.
Publicação inclui somente interface e links; nenhum documento ou dado real no Git público.

## 19/10/2026 - Compras por WhatsApp e reposição
Pedido colado conserva texto e conversa, prepara itens e permite ao dono registrar envio já realizado.
Estoque separado por unidade exige contagem e conversão; compras vinculadas descontam a reposição e entradas não duplicam recebimentos.
Notas separam manifestação Takeat de vínculo com compra; filtros não comprovam lançamento de estoque ou pagamento.
Validação: 130 testes, tipos, sintaxe JS e ensaio de banco revertido; sem pedidos fictícios persistidos.
Continuidade: registrar inventário, mínimos e embalagens reais; extrato bancário segue pendente para conciliação.

## 19/10/2026 - Cruzamento fiscal e financeiro
Referência da NF passa a ser preservada nas novas coletas financeiras; histórico antigo permanece intacto.
Notas distinguem chave encontrada, candidato, não localizado no recorte e base pendente; vencimento é independente da emissão.
Consulta não cria despesa nem confirma pagamento bancário; pais e parcelas não são somados entre si.
Revisão de permissões e privacidade, 137 testes, tipos e JavaScript; lista WhatsApp com dois fornecedores exige separação.
Continuidade: conferir resultado real após nova coleta e manter inventário/conversões para reposição.
