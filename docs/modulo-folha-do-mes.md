# Publicar a folha do mês no portal — 30/09/2026

A contabilidade (RC Assessoria) manda todo mês, por e-mail, um PDF com todo mundo junto. Esta tela separa por pessoa e publica cada pedaço para assinatura no portal, com o mesmo selo dos outros documentos: SHA-256 do arquivo no ato, horário do servidor, IP, aparelho e o texto do aceite.

## Como a contabilidade manda

Remetentes `gabriela@rcassessoria.com.br` e `dp2@rcassessoria.com.br`. Assunto no padrão `Folha de pagamento - <Mês>/<Ano> FEITORIA PUB` — e um e-mail separado para `FEITORIA DA CERVEJA`, porque são dois CNPJs. Conferido em julho, agosto e setembro de 2026: a estrutura é estável.

Anexos típicos:

| Arquivo | Formato | Vai para o portal? |
|---|---|---|
| `Recibo de Pagamento.pdf` | uma página por pessoa | sim, separado por pessoa |
| `Recibo de Vale Transporte.pdf` | vários recibos na mesma página | sim, reemitido um a um (ver abaixo) |
| `Recibo de Pagamento Pro Labore.pdf` | sócio | decisão sua; não é documento de colaborador |
| `DARF.pdf`, `FGTS.pdf`, `Relatorio do FGTS.pdf` | guias da empresa | não — são da empresa, não de ninguém |

## Onde fica

Aba **Documentos** → botão **Publicar folha do mês**. Você solta os PDFs, clica em Analisar, confere a tabela e publica. A separação acontece no navegador, de propósito: o casamento entre o nome impresso e o cadastro é a parte que erra, e documento publicado no nome errado é pior do que documento não publicado.

A competência sai do próprio documento, não do calendário: o holerite de agosto lê `Agosto de 2026` → `2026-08`, e o recibo de vale-transporte lê `período de Setembro de 2026` → `2026-09`. São competências diferentes no mesmo e-mail, e isso está certo — o vale é do mês seguinte.

Quem não casa com o cadastro aparece com o nome lido do PDF e um seletor vazio. Em agosto isso aconteceu com a **Valéria**, que não está cadastrada: o holerite dela foi separado mas não pode ser publicado até a ficha entrar.

## O vale-transporte não é separado: é reemitido

O recibo de vale-transporte vem com vários recibos na mesma página. Três caminhos foram testados, nesta ordem:

**Recortar.** É o que as ferramentas online de "split page in half" fazem: mexem na MediaBox ou usam `embedPage` com bounding box. Nos dois casos o texto do colega **continua dentro do arquivo** — o recorte esconde, não apaga, e qualquer extrator traz de volta nome, CPF e valor. Descartado.

**Redigir e cortar.** Redação de verdade (MuPDF) remove texto, vetor e imagem da área descartada antes de cortar. Funciona perfeitamente: 44 KB, texto selecionável, zero vazamento — conferido. Mas a MuPDF é **AGPL**, e puxar isso para dentro de uma aplicação web é decisão de licença, não de engenharia. Fica disponível para uso pontual aqui, fora do produto.

**Ler e emitir.** O caminho adotado. A tela lê os campos do recibo da contabilidade — nome, código, CPF, cargo, departamento, linhas de transporte com valor unitário, quantidade e total, total fornecido, empresa, período, cidade e data — e **emite o recibo individual** com pdf-lib, no mesmo desenho. O arquivo é construído do zero: não existe nada de outra pessoa nele porque nada de outra pessoa foi copiado. Saem 2,7 KB, com texto de verdade, contra 44 KB do recorte e 93 KB da imagem.

Se a leitura dos campos falhar em algum recibo, ele cai no plano B — a faixa redesenhada em imagem a 200 dpi. Pior de usar, mas nunca entrega o recibo do colega junto. A tela avisa quando isso acontece.

O original da contabilidade continua no e-mail, que é a fonte de tudo isso.

### Uma armadilha que custou uma rodada

A leitura dos campos falhava em silêncio na primeira versão. O motivo: o pdf.js devolve os pedaços de texto com a altura exata, e numa mesma linha da tabela o gerador do PDF varia meio ponto. Agrupar por altura arredondada partia `250 MOGI DAS CRUZES 48 x 5,50` de `R$ 5,50 R$ 264,00` em duas linhas, e a expressão que lê a linha de transporte não casava. Agora o agrupamento é por proximidade, com 2 pontos de tolerância.

### Por que o holerite NÃO é reemitido

A mesma técnica aplicada ao holerite seria um erro, por três razões:

1. **Não há problema a resolver.** O recibo de pagamento já vem com uma página por pessoa. Separa limpo, com o texto original.
2. **Não são "campos que mudam", são resultados calculados.** Bases de INSS, FGTS e IRRF, faixa de IRRF, códigos de rubrica — isso sai do sistema da contabilidade e é o que foi declarado no eSocial, na DARF e no FGTS. Transcrever é risco puro.
3. **Divergência de um centavo vira prova contra.** Num processo trabalhista, um holerite emitido por nós que não bate com o da contabilidade é pior do que não ter holerite nenhum. O documento que a pessoa assina tem que ser o mesmo que a empresa declarou.

A ideia de "modelo pronto e preencher os campos" está certa — só que o lugar dela é onde a Feitoria **é a emissora**: os 23 modelos de RH, folha de ponto, termo de EPI, advertência, recibo de entrega. Esse caminho já existe (`gestao-gerar`) e é onde vale investir.

## Testado

Em Chromium de verdade, com os PDFs reais de agosto. O holerite de três páginas foi lido, os três nomes saíram certos, duas pessoas casaram com o cadastro e a Valéria ficou sem colaborador. Os PDFs publicados foram conferidos depois: um colaborador por arquivo, sem vazamento. O recibo de vale-transporte da Giovana saiu reemitido, 2,7 KB, com todos os campos conferidos contra o original e texto selecionável — o nome da Valéria não aparece em lugar nenhum do arquivo. Nenhum erro de página.

## O que ainda não é automático

A tela não lê o e-mail sozinha: você baixa os anexos e solta. Automatizar isso exigiria dar ao servidor acesso permanente à caixa de e-mail da empresa, o que é uma decisão de segurança maior do que a conveniência justifica agora. Se um dia valer, o caminho é uma tarefa agendada que roda com o seu login, não uma chave guardada no servidor.

## Escala: colar da planilha

No mesmo pacote entrou um atalho na aba Operação. A escala da semana é montada na planilha `Setembro_Escala_PUB_Listas_Revisadas_Final.xlsx`, na aba **FUNÇÃO** — pessoa, horário e função por dia. Em "Publicar escala" existe agora **colar da planilha**: você copia o bloco da aba FUNÇÃO, clica, e o texto sai alinhado e pronto para a equipe ler no celular.

Nada é inventado na conversão: célula vazia some, e pessoa sem horário sai com `horário a definir`, para o buraco ficar visível em vez de passar batido. A montagem da escala continua na planilha, como combinado — isto é só a ponte até a tela da equipe.
