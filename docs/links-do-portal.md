# Links do Portal Feitoria — onde cada coisa mora

_Atualizado em 29/09/2026._

## Os documentos deste projeto

Em 25/09 os 18 documentos foram unificados em 11. Onde procurar cada coisa:

| Documento | Serve para |
|---|---|
| `estado-atual.md` | **Leia primeiro.** O que está no ar, a infraestrutura, os números de hoje e as pendências |
| `links-do-portal.md` | Este. URLs, tokens, repositórios, rotinas agendadas |
| `referencia-api-takeat.md` | Tudo sobre a API da Takeat: autenticação, limites, payloads, carga histórica |
| `modulo-validade-e-prazos.md` | Validade por item, a tabela de prazos da casa, painel, guardar de outro jeito |
| `etiqueta-e-impressora.md` | A etiqueta, a NIIMBOT B1 Pro, Web Bluetooth e a análise da Suflex |
| `modulo-de-contagem.md` | Contagem física de estoque |
| `gestao-de-pessoas-desenho.md` | Por que o módulo de pessoas foi feito assim |
| `cct-sindresbar-regras.md` | A convenção coletiva e as regras de cálculo da folha |
| `documentos-rh-modelos.md` | Os 23 modelos de RH e o dicionário de campos |
| `negocio-numeros-e-clube.md` | O retrato do negócio e o desenho do Clube |
| `historico-e-decisoes-superadas.md` | O que mudou de rumo e por quê, mais o material de fundação |
| `revisao-28-09-conferida.md` | A revisão externa conferida contra o código, achado por achado |

## Regra que explica o resto

O gateway de Edge Functions deste projeto **descarta o cabeçalho `content-type`**: qualquer HTML servido por função aparece como código no navegador, com acentos quebrados. Confirmado em 17/09 com uma função de uma linha. Não se conserta no código.

Então: **Edge Function só devolve JSON. Página HTML mora no GitHub Pages.**

## Repositórios e páginas

**Etiquetas** — https://github.com/dougfb46/feitoria-etiquetas (público, `main`, `index.html` na raiz)

- PUB Mogi: https://dougfb46.github.io/feitoria-etiquetas/?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2
- Prainha Buena Onda: https://dougfb46.github.io/feitoria-etiquetas/?u=cd5b3853-9c13-4f8b-9171-b552d65e27ad

Etiqueta 50 × 30 mm a 300 dpi, desenhada em canvas e enviada à NIIMBOT B1 Pro por Web Bluetooth. Sem Bluetooth, cai na impressão do navegador.

**Portal** — https://github.com/dougfb46/feitoria-portal (arquivos na raiz, Pages em `main` + `/ (root)`)

| Para quem | Link |
|---|---|
| Tablet do salão (ponto) | https://dougfb46.github.io/feitoria-portal/ponto.html?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2&t=576cee22-d66f-446b-aca8-639d5c1ec4fe |
| Celular do colaborador (ponto) | https://dougfb46.github.io/feitoria-portal/ponto.html?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2 |
| Portal do colaborador (documentos) | https://dougfb46.github.io/feitoria-portal/portal.html?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2 |
| Operação (mapa, cervejas, turno, recado) | https://dougfb46.github.io/feitoria-portal/operacao.html?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2 |
| NR-1 · saúde no trabalho (público) | https://dougfb46.github.io/feitoria-portal/nr1.html?u=48f7713d-add7-4246-b5f1-c03e3a8d9ce2 |
| Gestão | https://dougfb46.github.io/feitoria-portal/gestao.html |

Os dois últimos links da equipe — operação e NR-1 — **não pedem PIN**. É de propósito: são material de consulta e de informação de segurança, e trancar isso atrás de senha só faria a equipe não usar. O que exige identificação é assinar um recado, e aí o PIN entra na hora.

O link do NR-1 também aparece pronto para copiar na aba NR-1 da gestão. Vale imprimir como QR no quadro de avisos e no vestiário — é assim que a prova de comunicação se sustenta.

### O que muda entre os dois links do ponto

O parâmetro `t` é o **token do totem** e só existe na URL salva no tablet. Marcação que chega com ele é tratada como totem e não pede localização — o aparelho não sai do lugar.

Marcação sem o `t` é tratada como **celular**: só é aceita se a unidade tiver o ponto pelo celular ligado (aba Escala → Ponto pelo celular) e só dentro do raio marcado. Quem está no pub com GPS ruim pode insistir: a marcação entra com a distância medida gravada e abre pendência `fora_da_cerca` para a gestão conferir.

Trocar o `totem_token` da unidade no banco invalida a URL antiga do tablet — é o caminho se o link vazar.

Tokens do totem: PUB Mogi `576cee22-d66f-446b-aca8-639d5c1ec4fe`, Prainha `e1e1238a-7b5b-4150-b1fc-6db336832852`.

## Backend

Supabase `portal-feitoria`, ref `kujelbcbrcmkitzyswbh`, sa-east-1, plano gratuito. Projeto gratuito pausa após ~7 dias sem uso; `restore_project` traz de volta sem perder dados.

Funções: `etiqueta`, `ponto`, `portal`, `operacao`, `gestao-equipe`, `gestao-documentos`, `gestao-gerar`, `gestao-modelos`, `gestao-folha`, `gestao-pendencias`, `takeat-auth-status`, `takeat-sync-catalogo`.

A `operacao` é a única que atende dois públicos na mesma função: `verify_jwt` está desligado no gateway e a checagem acontece ação por ação — público em `painel`, `recado` e `nr1`; login de dono ou gerente em `recados`, `tratar`, `posicoes`, `publicar`, `escalas`, `nr1_painel`, `nr1_risco` e `nr1_informativo`.

Rotina agendada: `vigia-do-ponto`, pg_cron, todo dia às 05:10 UTC (02:10 em São Paulo) — detecta as inconsistências do ponto e manda o resumo por e-mail. A chave da Resend vive no Vault; o endereço que recebe o aviso fica em `restaurants.email_avisos`, porque é configuração de unidade e não segredo.

Limite de tentativas de PIN: `verificar_pin_limitado`, 15 erros por IP e unidade em 10 minutos, ligado em `ponto`, `portal` e no recado assinado da `operacao`. No `portal`, errar a data de nascimento também conta.

## Outros projetos

- **Landing page**: projeto Lovable "Gitnub Publish" — taplist do AbleSign, eventos por planilha.
- **Portal de gestão no Lovable**: projeto "Feitoria Portal", não publicado. O caminho passou a ser o GitHub Pages, para poupar créditos.

## Pendências

- Marcar o ponto da unidade no mapa (aba Escala → "Usar onde estou", com o celular dentro do pub) antes de liberar o ponto pelo celular.
- Definir PIN dos quatro CLT — hoje só o colaborador de teste tem.
- Apagar a função temporária `takeat-probe`.
- Apagar o colaborador de teste (`Teste Cozinha`, PIN 1234) e suas marcações antes de entrar em operação; junto saem os recados de teste, as posições semeadas e a escala de música de exemplo.
- Ligar a B1 Pro e testar; se sair fraca, subir a densidade de 3 para 4.
- Corrigir o `av-qtd` no repositório de etiquetas (ver `revisao-28-09-conferida.md`).
