# Revisão dos modelos de RH — Feitoria

Versão: 07/10/2026. Este diretório contém **23 novas versões de revisão** dos modelos 04–26. Não substitui arquivos anteriores nem documentos emitidos ou assinados. Nenhum modelo foi importado no Supabase ou enviado à equipe.

Leia o conteúdo reunido em [LEITURA-COMPLETA.md](LEITURA-COMPLETA.md). Os JSON mantêm os tipos de bloco usados pelo gerador atual. `ativo: false` em todos os arquivos é deliberado: são minutas em revisão, não modelos liberados para assinatura. Os campos adicionais de revisão são metadados deste pacote e não implementam bloqueios no backend existente.

## Ajustes feitos

- Contrato CLT adaptado à operação presencial de cozinha, bar, salão, caixa e apoio. Removidos exemplos de construção civil, exclusividade genérica, transferência irrestrita e banco de horas presumido.
- Prestação de serviços separa contratante e contratado, pessoa física ou jurídica, representantes e assinatura. Eliminados contatos de terceiros, percentual contraditório e foro de outra cidade. Não há declaração de ausência de vínculo independentemente da realidade.
- Descontos e sanções automáticos removidos dos contratos e termos. Desgaste normal não é tratado como dano. Uniformes, EPI e acesso individual são distintos; nunca registrar senha ou PIN.
- Uso publicitário de imagem não está incluído na assinatura do contrato. Se desejado, exige documento específico e facultativo, com finalidade e alcance definidos.
- Câmeras e ferramentas digitais têm informação concreta sobre alcance e privacidade. A assinatura de ciência não substitui a avaliação do tratamento. Aparelho pessoal não fica sujeito a inspeção geral.
- Cargo de liderança não afasta ponto automaticamente. Poderes e alterações salariais precisam corresponder à prática real.
- Modelo 20 reúne o aviso de privacidade da equipe e os deveres de acesso: ponto com foto, registros, assinatura, Drive privado, retenção, direitos e canal anônimo. Empregado não é chamado automaticamente de operador independente; multas da empresa não são transferidas por assinatura.
- Ficha cadastral e declaração de dependentes ganharam os campos antes ausentes. Documento de saúde não substitui ASO nem solicita histórico clínico à gestão operacional.
- Treinamento registra participação real, conteúdo, duração e pendências; assinatura não antecipa presença ou certifica domínio. Protocolo identifica documentos efetivamente recebidos e a pessoa que recebeu.
- Política contra assédio abrange clientes, prestadores e gestores; inclui canal anônimo existente, não retaliação e necessidade de alternativa independente quando o relato envolve a gestão.
- Boas-vindas e POP de contratação são material interno, não termos individuais de adesão.
- Banco de horas, premiação, teletrabalho e não concorrência permanecem fora do pacote atual: 14, 15, 16 e 21. Não se cria política nova por correção editorial.

## Onde cada modelo se aplica

| Modelos | Uso |
|---|---|
| 04, 11, 12, 13, 19, 20, 22, 23, 24 | CLT ou prestador quando pertinente à atividade; não enviar todos indistintamente |
| 05, 08, 09, 10 | CLT; conferir necessidade, momento e dados reais |
| 06 | Prestação específica após avaliação da relação efetiva; não usar como blindagem de freela recorrente |
| 07 | Unidade com câmeras existentes; preencher informação concreta |
| 17, 18 | Liderança e alteração contratual específicas; não para a equipe inteira |
| 14, 15, 16, 21 | Reserva, sem adoção na operação atual |
| 25 | Comunicação interna com nome de uso e função; sem assinatura obrigatória |
| 26 | Procedimento da gestão; não enviar como contrato ao prestador |

## Pendências antes da emissão

1. Confirmar razão social, CNPJ, unidade, representante e cadastro de cada pessoa. O nome da marca não substitui a empresa contratante; não assumir um mesmo CNPJ para as duas unidades.
2. Confirmar com a contabilidade a CCT e o enquadramento, salários, adicionais, gorjetas, benefícios, jornada e descansos. O pacote não fixa os percentuais ainda em discussão.
3. Conferir juridicamente o contrato CLT e a prestação real dos freelas; contratos de liderança e alterações exigem análise do caso.
4. Confirmar câmeras/áudio existentes, responsáveis, retenção e fluxo de pedidos de privacidade. A política não inventa prazo único de retenção.
5. Definir alternativa independente para relato contra a gestão e responsáveis pela apuração. O canal anônimo do portal existe, mas o modelo não inventa uma ouvidoria já contratada.
6. Validar EPI, orientações e documento ocupacional com quem responde pela segurança e saúde. Seleção de EPI e aptidão não são definidas pelo modelo.
7. Preencher todos os marcadores `[[...]]`, resolver as pendências listadas e conferir a versão final por pessoa. Não remover os avisos de minuta para ocultar lacunas. Aprovação deve ser registrada antes da importação e emissão.

## Fontes conferidas em 07/10/2026

- [CLT compilada](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm): jornada, alteração contratual, descontos e cargo de gestão.
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm): finalidades, hipóteses legais, direitos, segurança e retenção.
- [ANPD — agentes de tratamento](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado).
- [ANPD — legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse).
- [MTE — NR-6 vigente](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-6-nr-6).

As fontes sustentam a correção das previsões genéricas. A CCT da Feitoria e as condições individuais ainda não foram confirmadas; esta revisão não é aprovação jurídica dos contratos.

## Controle de versão e verificação

Cada JSON registra o SHA-256 do original e a finalidade. `manifesto.json` lista públicos e pendências. Conferidos: 23 arquivos, sequência 04–26, formato dos blocos, marcadores reconhecidos pelo gerador, ausência de dados reais, preservação dos originais e separação das assinaturas no contrato de prestação. Ainda não houve geração pelo portal, emissão de PDF final, importação ou coleta de assinatura.

O SHA-256 de origem é calculado sobre UTF-8 com quebras de linha normalizadas para LF, para produzir o mesmo resultado no Windows e no Linux. Verificação local: node tests/revisao-modelos.cjs.
