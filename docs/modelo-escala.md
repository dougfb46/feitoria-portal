# Modelo da escala — extraído de `Setembro_Escala_PUB_Listas_Revisadas_Final.xlsx`

_Lido em 23/09/2026. Esta é a versão de setembro, mais evoluída que a de agosto:
ganhou ESCALA INTEGRADA e PLANO DE INTERVALOS._

## Abas e o que cada uma é

| Aba | Papel |
|---|---|
| `CADASTRO` | pessoas, horários-padrão, intervalos e jornadas por pessoa × dia |
| `21.09-27.09`, `07.09-13.09`, `31.08-06.09` | uma aba por semana, congelada como histórico |
| `ESCALA INTEGRADA` | visão consolidada |
| `PLANO DE INTERVALOS` | gerador automático de pausas com regras operacionais |
| `HISTÓRICO PAGAMENTOS` | pagamentos fechados por semana |
| `APOIO CÁLCULOS` | fórmulas de apoio |

## Três tipos de pessoa

- **Funcionário da casa** — CLT. Sem valor na planilha; o pagamento é folha.
- **Freela fixo** — valor semanal base (R$ 528 por 44 h, R$ 12/h no cadastro atual).
- **Freela variável** — pago por turno, conforme a duração: 8 h = R$ 110, 6 h = R$ 90, 4 h = R$ 60.

O cadastro tem 28 pessoas, das quais parte está com `Ativo? = NÃO` (histórico preservado,
não apagado — mesma lógica aditiva que já usamos no catálogo).

## Estrutura da semana

A aba semanal tem `B2` = segunda-feira da semana, e as colunas são ordenadas com
**sexta, sábado e domingo primeiro** — porque é onde está 71% da receita. Cada dia tem
três colunas: Pessoa, Horário, Pausa/Status. Até 15 linhas de escala por dia.
`FOLGA` aparece como status no lugar do horário.

Volume real da semana 21–27/09: 4 pessoas fixas todos os dias, mais 4 a 6 freelas
variáveis concentrados em sexta e sábado à noite (18:30–00:45).

No rodapé da mesma aba, dois blocos:

- **Resumo semanal da equipe permanente** — horas feitas, saldo 44 h, ajuste, base fixa, total.
- **Pagamentos dos freelas da semana** — pessoa, tipo, horas, valor calculado, valor pago,
  data, pago?, diferença, observação.

Fechada a semana, as linhas pagas são copiadas **como valores** para `HISTÓRICO PAGAMENTOS`.
Pagamentos registrados: R$ 3.181,40 (31/08–06/09) e R$ 2.119,92 (07/09–13/09).

## Regras do plano de intervalos

Parametrizado no topo da aba, e são regras de negócio de verdade:

- mínimo de **2 pessoas trabalhando** durante qualquer pausa;
- no máximo **3 pessoas iniciando pausa juntas**;
- todas as pausas terminam até **19:30**;
- sexta e sábado exigem mais gente ativa;
- pico de almoço no fim de semana 12:30–13:30; pico da noite 20:30–21:30;
- a ordem das pessoas na lista é prioridade: quem está em cima tenta pausa mais cedo;
- quando não há cobertura, o status sai como `SEM OPÇÃO` / `REORGANIZAR — MÍN. 2 ATIVOS`.

Duração da pausa por jornada: 8 h → 1 hora; 6 h → 15 min; 4 h → sem intervalo.

## O que isso significa para o portal

1. A planilha **já é um sistema**, com regras, histórico e fechamento financeiro. Substituí-la
   exige cobrir as regras de intervalo acima, não só guardar horários.
2. O trabalho semanal real é montar a escala e fechar o pagamento dos freelas — não é ponto.
3. **Atenção a dados pessoais:** a coluna Pix guarda CPF, CNPJ, telefone e e-mail de pessoas
   físicas. Ao migrar para o banco, essa coluna precisa de acesso restrito (não vai para
   nenhuma tela de operação, não sai em relatório, não entra em log). Hoje ela está num
   arquivo que circula por link do Drive — vale rever isso independentemente do portal.

## Tabelas sugeridas

- `staff` — pessoa, tipo (`clt` / `freela_fixo` / `freela_variavel`), ativo, contato.
  Chaves de pagamento em tabela separada, com acesso restrito.
- `shift_templates` — horários-padrão (início, fim, horas, duração da pausa, valor do turno).
- `schedule_weeks` / `schedule_slots` — semana, dia, pessoa, horário, pausa, status.
- `freela_payments` — semana, pessoa, horas, valor calculado, valor pago, data, observação.
- `break_plan_rules` — os parâmetros acima, editáveis sem mexer em código.
