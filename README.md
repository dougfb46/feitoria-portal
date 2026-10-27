# Feitoria Portal — telas públicas

Este repositório contém somente as páginas e os arquivos estáticos do portal.
Cadastros, registros de ponto, fotos e documentos são consultados no servidor,
conforme identificação e autorização. Não inclua dados reais ou segredos aqui.

O desenvolvimento completo e o histórico anterior ficam no repositório privado
`dougfb46/feitoria-portal-interno`. As URLs do portal permanecem as mesmas.

Alterações entram por branch e pull request. A verificação de publicação restringe
os arquivos permitidos; ela complementa a revisão humana e não comprova ausência
de todo tipo de dado pessoal. Segredos permanecem no Supabase.


A aba **Boletim do dono** reúne análise do agente e indicadores de gestão após autenticação. Conteúdo dos boletins e dados de negócio permanecem no serviço privado; este repositório contém apenas a interface.


A aba **Histórico financeiro** oferece consulta de documentos e referências às fontes após autorização do dono. Os arquivos públicos contêm somente a interface, sem o histórico financeiro.

O portal de gestão e o portal do colaborador usam a base visual Sage fornecida pelo dono: componentes, gráficos, navegação e painel do agente. O login e os serviços existentes permanecem nas páginas de serviços. A demonstração visual só é ativada por ?preview=1 e exibe dados fictícios. Drive, Calendar e Gmail mostram o estado de integração pendente; Gemini utiliza o serviço autenticado já existente.
