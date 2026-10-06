# Mapa do sistema — o que existe no ar

Levantado em 06/10/2026 direto do projeto Supabase `kujelbcbrcmkitzyswbh`.
Este arquivo é o inventário de referência: use-o para saber **o que baixar** com
`supabase functions download <slug>` e para conferir se o repositório está completo.

## Edge Functions no ar — 21

### Em uso (15)

| Slug | Versão | `verify_jwt` | O que faz |
|---|---|---|---|
| `portal` | 7 | false | Portal do colaborador: PIN + data de nascimento, holerite, VT, documentos |
| `ponto` | 8 | false | Marcação de ponto com PIN e foto, selo e hash encadeado |
| `checklists` | 3 | false | Checklists K01–K17: equipe executa, gestão importa e revisa |
| `operacao` | 4 | false | Tela do salão: posições, escalas, recados (anônimos ou assinados), NR-1 |
| `contagem` | 6 | false | Contagem de estoque |
| `fechamento` | 7 | false | Fechamento do dia, perdas e sobras |
| `etiqueta` | 13 | false | Etiquetas e validade (consumida pela tela da cozinha, repo separado) |
| `gestao-equipe` | 7 | true | Cadastro de equipe |
| `gestao-documentos` | 4 | true | Documentos e assinaturas |
| `gestao-modelos` | 4 | true | Modelos de documento de RH |
| `gestao-gerar` | 4 | true | Gera documento a partir de modelo (Feitoria como emitente) |
| `gestao-folha` | 5 | true | Folha do mês, holerite e VT |
| `gestao-pendencias` | 4 | true | Pendências de ponto |
| `takeat-sync-catalogo` | 10 | false | Espelha insumos e intermediários em `takeat_catalog` |
| `takeat-auth-status` | 4 | true | Diagnóstico da conexão com a Takeat — responde estado, **nunca valores** |

Regra geral: `verify_jwt = false` é função com **público misto**. A autorização
acontece dentro do código, ação por ação — nunca presuma que `verify_jwt = false`
significa rota aberta.

### Para apagar (6)

Experimentos e sondas que ficaram no ar. Nenhuma tela chama. Confirme com uma busca
no repositório antes de apagar, mas a intenção é remover:

| Slug | Por que sai |
|---|---|
| `oi` | teste de "hello world" |
| `painel` | tentativa de servir HTML por function — descartada, ver AGENTS.md |
| `gestao` | substituída pelas `gestao-*` |
| `cozinha` | substituída por `etiqueta` |
| `takeat-probe` | sonda que descobriu o formato real do payload; cumpriu o papel |

## Migrations aplicadas — 54

Em ordem. O repositório só carrega `20260922_takeat_oauth_tokens.sql`; o resto vem com
`supabase db pull`.

**Fundação (06/09)** — `fundacao_unidades_perfis_papeis`,
`equipe_pins_e_modulo_etiquetas`, `rls_todas_as_tabelas`,
`restringir_execute_das_funcoes`, `catalogo_takeat_e_vinculo`,
`unidade_ganha_id_da_takeat`

**Etiquetas e validade (17–18/09)** — `view_equipe_sem_expor_hash`,
`preparos_unidade_e_fila_takeat`, `controle_de_validade_por_item`,
`absorver_provisorios_na_sincronizacao`, `relatorio_diario_perdas_e_sobras`,
`medida_do_item_e_horizonte_por_metodo_v2`, `quantidade_e_unidade_separadas_v3`

**Takeat (22/09)** — `takeat_oauth_tokens`, `enable_pg_net`,
`catalogo_takeat_chave_por_nome`, `unidade_aponta_para_credencial_takeat`

**Ponto, documentos e folha (23–24/09)** — `ponto_fundacao`,
`documentos_e_assinaturas`, `portal_colaborador_identidade`,
`empresa_ficha_e_modelos`, `parametros_de_folha`,
`jornada_semanal_do_colaborador`, `guardar_de_outro_jeito`,
`escala_feriados_e_pendencias`, `rls_escala_feriados_pendencias`,
`detector_de_pendencias_de_ponto`, `detector_de_pendencias_ponto_v2`,
`vigia_do_ponto_cron_e_email`, `totem_token_e_pendencia_externa`,
`fechar_gatilhos_e_fixar_search_path`, `selo_do_ponto_qualifica_digest`,
`qualificar_digest_nas_funcoes_de_selo`

**Dia operacional, contagem e acesso (25/09)** —
`perdas_sobras_usa_o_dia_operacional_de_01h`, `modulo_de_contagem`,
`categoria_do_catalogo`, `horas_restantes_pode_ser_negativa`,
`recriar_resumo_de_validade`, `perfil_de_acesso_ao_portal`,
`email_de_avisos_fora_do_vault`

**Fechamento e revalidação (26/09)** — `fechamento_do_dia`,
`relatorio_do_dia_conta_baixa_avulsa`, `dia_operacional_vira_as_0130`,
`foto_obrigatoria_e_destino_revalidado`, `revalidacao_conta_no_relatorio`,
`baixa_coerente_aceita_revalidado`

**PIN, operação e NR-1 (29/09)** — `limite_de_tentativas_de_pin`,
`operacao_recados_posicoes_e_escala`, `trava_de_revalidacao`,
`lote_sem_corrida`, `nr1_riscos_informativos_e_canal`

**Checklists (01/10)** — `checklists_e_fila_de_aprovacao`

**Sincronização pelo vault (05/10)** — `sync_catalogo_pelo_vault`,
`sync_catalogo_espera_a_resposta`

> **Resolvido em 06/10/2026.** A sequência `perdas_sobras_usa_o_dia_operacional_de_01h`
> (25/09) e depois `dia_operacional_vira_as_0130` (26/09) deixou documentação
> contraditória pelo projeto. Lido direto do banco: `public.dia_da_baixa` subtrai
> `interval '1 hour 30 minutes'`, e `public.data_operacional` só a chama. **O corte em
> vigor é 01:30.** Onde algum `.md` diz 01:00, o `.md` está errado.

## Telas no GitHub Pages

| Arquivo | Tamanho | Público | Publicada? |
|---|---|---|---|
| `web/portal.html` | 10,8 KB | colaborador, celular | sim |
| `web/nr1.html` | 13,8 KB | equipe, celular | **não** |
| `web/ponto.html` | 15,0 KB | equipe, celular | versão antiga no ar |
| `web/checklist.html` | 16,5 KB | equipe, celular | **não** |
| `web/operacao.html` | 22,8 KB | atendentes, celular | **não** |
| `web/gestao.html` | 131,1 KB | dono e gerentes, desktop | sim |
| `web/contagem.html` | — | equipe | **não existe no repositório** |

A lacuna de publicação é a pendência mais antiga em aberto. Os arquivos existem no
repositório; falta subir para o GitHub Pages.

## Tabelas que o código assume

Não é o schema completo (use `supabase db pull`), são as que aparecem no código das
functions e cujo comportamento tem regra atrelada:

- `restaurants` — unidade; `public_token` é o que aparece na URL das telas públicas
- `employees`, `user_roles` — pessoas e papéis (papel **nunca** no perfil)
- `pin_tentativas` — tentativas de PIN; **não guarda o PIN tentado**
- `takeat_oauth_tokens` — tokens da Takeat; RLS ligada e **zero policies**
- `takeat_catalog` — espelho de insumos e intermediários, chave `name_key`
- `checklist_modelos` / `checklist_execucoes` / `checklist_respostas` /
  `checklist_ocorrencias` + view `vw_checklist_respostas_atuais`
- `nr1_riscos` / `nr1_informativos` + view `vw_nr1_riscos_atuais`
- `operacao_recados`, `turno_posicoes`, `escala_publicada`
- `aprovacoes_pendentes` — fila de aprovação (espinha do fluxo agente → gestor → portal)

Funções de banco com regra: `data_operacional(p_ts)`,
`verificar_pin_limitado(...)`, `pode_receber_recado(_restaurant_id)`, `has_role(...)`,
`takeat_begin_rotation` / `takeat_commit_rotation` / `takeat_fail_rotation` /
`takeat_release_rotation`.
