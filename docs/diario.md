## 2026-10-07 · Codex — portal integrado do colaborador
Fiz: integrei navegação de documentos, treinamentos/certificados, ponto, checklists, escala/avisos e saúde/segurança na página portal.html. Ponto no celular usa a regra atual de localização; totem continua com seu endereço e PIN próprios, sem identificação automática do portal.
Aberto: K01, fundo de troco, cadastros e jornada; validação de turno com usuários reais. Treinamentos listam documentos disponíveis, não certificam conclusão automaticamente; escala/avisos mostram a consulta coletiva publicada, não uma escala individual nova.
Cuidado: backend parte da versão viva 8, devolve permissão de ponto e tipos de treinamento após a autenticação existente. PIN permanece em memória, não em URL/armazenamento; documentos mantêm confirmação individual. Identificação entre páginas só na mesma origem, janela e unidade; totem não aceita essa passagem. Sessão do portal encerra após 5 minutos sem interação.
Próximo passo: publicar e conferir as telas; configurar pessoas e permissões e acompanhar o primeiro uso. Testes locais de origem, unidade, identificação única, totem e fotos passaram; navegação conferida no navegador com dados fictícios e API local, sem gravação real.
## 2026-10-07 · Codex — checklist e acessos
Fiz: corrigi foto que assumia conforme; respostas sem evidência ou com erro ficam pendentes e não permitem fechar pela tela. Criei web/acessos.html e aba Acessos na gestão, por unidade.
Aberto: modelo K01 e fundo de troco ainda pendentes; cadastros/PINs aguardam Douglas. Teste de turno real não realizado.
Cuidado: backend checklists parte da versão viva 4, preserva evidência de correção somente do mesmo item/linha e verifica foto condicional na gravação e na conclusão. Sem resposta/execução fictícia. Endereço do totem não entra nos links da equipe.
Próximo passo: confirmar publicação das telas; configurar usuários e permissões pela gestão; revisar/importar K01 e realizar o piloto real.

## 2026-10-07 · Codex — revisão dos documentos de RH
Fiz: criei 23 novas versões 04–26 em modelos/revisados-v2, com leitura completa, aplicação por público, fontes e pendências. Corrigidos resíduos de construção civil, identificação, prestação, descontos, imagem, privacidade e evidências.
Aberto: dados individuais, CCT/adicionais, câmeras/retenção, canal independente contra assédio e validação jurídica/contábil e de saúde ocupacional. Push bloqueado pela revisão automática: políticas internas de RH em repositório público exigem autorização específica; pacote permanece local.
Cuidado: todos os V2 estão inativos e não importados. Originais e documentos emitidos/assinados não foram alterados. Banco de horas já era inativo; 14/15/16/21 fora da operação atual. Sem PIN, Pix, salário ou dado real da equipe.
Próximo passo: revisar o pacote; resolver as pendências reais e registrar aprovação antes de importar novas versões e emitir documentos por pessoa.

# Diário de sessão

Quem trabalhou no projeto escreve aqui **antes de encerrar**. Entrada nova vai
**no topo**. Isto substitui a conversa entre os agentes: o Claude e o Codex não se
falam, então o que não estiver escrito aqui não chega ao próximo.

Formato — cinco linhas, sem cerimônia:

```
## AAAA-MM-DD · <Claude | Codex | Douglas>
Fiz: ...
Aberto: ...
Cuidado: ...
Próximo passo: ...
```

`Cuidado:` é a linha mais importante. É onde entra "não mexa em X", "Y está pela
metade", "Z parece defeito mas é de propósito".

---

## 2026-10-06 · Codex
Fiz: importei feitoria-portal-codex.zip em branch para revisão no GitHub.
Aberto: pacote não contém todo o estado vivo; não houve deploy de functions ou migrations.
Cuidado: arquivos da raiz foram preservados para manter os endereços atuais; novas versões estão em web/.
Próximo passo: revisar o PR e definir a publicação das telas; obter o estado vivo antes de alterar lógica.


## 2026-10-06 · Claude

**Fiz:** montei o pacote de transferência para o Codex. Criei o `AGENTS.md` (regras
que não se negociam, contexto legal, coisas já testadas que não funcionam), o
`docs/mapa-do-sistema.md` (inventário do que está no ar) e este diário. O `CLAUDE.md`
virou ponteiro para o `AGENTS.md` — a versão antiga descrevia o estado de 23/09 e
contradizia a realidade. Sincronizei as 6 telas de `web/` com as versões atuais.

**Aberto:** o repositório ainda não tem a cópia completa do que está no ar — 21 Edge
Functions e 54 migrations contra 5 functions e 1 migration aqui. O README tem o
bootstrap (`supabase db pull` + `functions download`). **Rodar isso é o primeiro
trabalho de quem pegar o projeto.**

**Cuidado:**
- O dia operacional fecha às **01:30**, não 01:00. Confirmado no banco em 06/10
  (`dia_da_baixa` subtrai `interval '1 hour 30 minutes'`). Vários `.md` antigos dizem
  01:00 — estão errados.
- `work_schedules` está **vazia** (0 linhas), com 4 colaboradores marcando ponto. Por
  isso "Total Esperado", "Presentes/Ausentes" e "Horas Extras" aparecem zerados, e as
  4 pendências de ponto abertas comparam contra uma jornada que não existe. O
  formulário de cadastro já existe na `gestao.html`. **É cadastro, não código.**
- `web/contagem.html` não existe neste repositório e nunca existiu neste ambiente.
- Sobraram 2 registros de teste em `checklist_respostas` (K99). Os triggers foram
  reabilitados e conferidos (`tgenabled = 'O'`).

**Próximo passo:** cadastrar a jornada dos 4 CLT; depois `av-qtd` no repositório de
etiquetas (único defeito conhecido que corrompe dado); depois publicar as 4 telas
pendentes no GitHub Pages.

### 06/10/2026 — Política de privacidade da integração
Página pública web/privacidade.html criada e linkada na gestão.
Descreve uso real do Drive, escopo amplo, pastas limitadas no código, backup de PDFs/assinaturas e retenção sem limpeza automática.
Contato feitoria.mogi@gmail.com, informações de revogação, pedidos e fornecedores.
Publicação autorizada por Douglas com 'execute tudo', para completar Branding e sair de Testando.
Conferidas sintaxe/links e apresentação local; sem scripts, credenciais ou dados de pessoas na página.
