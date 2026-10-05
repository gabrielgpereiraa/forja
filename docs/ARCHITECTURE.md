# Arquitetura — Forja

## 1. Princípios de produto que guiam o código

- **Hábito ≠ tarefa.** Hábito é recorrente e medido pela *frequência semanal* (círculo com anel de progresso, cor e ícone próprios). Tarefa é pontual, com data e prioridade (checkbox quadrado, sem cor). A diferença é visual, de linguagem e de modelo de dados.
- **O dia é a unidade de desempenho.** O painel "Hoje" responde: o que fazer, quanto já fiz, quanto falta e qual a nota até agora. "Completar dia" fecha um *snapshot* imutável com nota explicável.
- **Gamificação reforça, não compete.** XP, níveis, atributos e conquistas são derivados de um *ledger* de recursos — nunca de contadores espalhados.
- **Fricção mínima.** Concluir = 1 toque. Tarefa nova = digitar + Enter (data/prioridade com chips). Progresso parcial (minutos, páginas) = painel com atalhos `+5 / +10 / +15 / +30`.

## 2. Camadas

```
src/
├── domain/                 ← regras puras, sem React (100% testável)
│   ├── date.ts             datas ISO locais, "dia de produtividade", semana seg→dom
│   ├── models/             Habit, HabitLog, Task, DailyRecord, gamificação, atributos
│   ├── rules/              agenda de hábitos, agenda de tarefas, visão do dia/semana,
│   │                       streaks, histórico, estatísticas do jogador
│   ├── scoring/            nota diária: contratos, estratégia v1, faixas (tiers)
│   └── gamification/       regras de recompensa, motor do ledger, níveis, conquistas
├── services/               camada de aplicação
│   ├── commands.ts         comandos puros (data, args) → { data, feedback }
│   ├── app-data.ts         formato persistido + migrações
│   ├── storage.ts          StorageAdapter (localStorage c/ fallback em memória)
│   └── demo-seed.ts        dados de exemplo gerados pelos MESMOS comandos
├── store/                  Zustand: app-store (persistido) e ui-store (modais)
├── hooks/                  leitura memoizada do domínio (useDayOverview, usePlayer…)
├── components/             design system: ui/ (shadcn), progresso, check, layout…
├── features/               telas e componentes por área
│   ├── today/  habits/  tasks/  progress/  profile/  onboarding/
│   └── feedback/           toasts de XP/meta/conquista + hooks de ação com "Desfazer"
└── app/                    App (rotas, tema) e AppShell (nav inferior / sidebar)
```

Fluxo: **página → hook de ação → store → comando puro → domínio**. Páginas não contêm regra de negócio: leem visões prontas (`useDayOverview`, `useWeekOverview`, `usePlayer`) e disparam ações.

## 3. Modelo de dados

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| `Habit` | `name, category, schedule {weeklyGoal, days\|null}, target {amount, unit}\|null, icon, color, archived, startDate, confirmNextDay?, goalHistory?, progressionSnoozedUntil?` | `days = null` → frequência flexível; `confirmNextDay` → confirmado na revisão da manhã seguinte; `goalHistory` → metas por semana |
| `HabitLog` | `habitId, date, value, completed` | 1 por hábito/dia; `value` acumula minutos/páginas; `completed` é snapshot |
| `Task` | `title, dueDate\|null, priority, completed, completedOn, createdOn` | `completedOn` = dia de produtividade |
| `DailyRecord` | `date, score\|null, breakdown, completed/total habits & tasks, closedBy` | imutável; `score = null` = dia sem plano (neutro) |
| `LedgerEntry` | `resource, amount, reason, ruleId, sourceKey, date, attribute?` | base de XP, foco, moedas futuras… |

Datas são `YYYY-MM-DD` locais (`ISODate`). O **dia de produtividade** vira às 4h por padrão (configurável): registrar algo à 1h conta para o dia anterior.

## 4. Agenda de hábitos (o que "deveria" ser feito hoje)

Para cada hábito calcula-se o **ritmo esperado**: quantas sessões deveriam estar feitas até o fim de cada dia.

- Flexível: `ceil(meta × diasDecorridos / 7)` → para 4x/semana: 1, 2, 2, 3, 3, 4, 4.
- Dias fixos: contagem dos dias escolhidos até hoje.
- Hábito criado no meio da semana tem meta proporcional.

Daí saem estados claros e usados na UI:

| Estado | Regra |
| --- | --- |
| `required` (Hábitos de hoje) | feitas antes de hoje < esperado até hoje (e, se tiver dias fixos, hoje é um deles) |
| `optional` (Opcionais hoje) | adiantado no ritmo — fazer é bônus |
| `goal_met` | meta semanal já batida |
| pace `behind` / `at_risk` | atrasado no ritmo / impossível bater a meta |
| pace `met` / `exceeded` | meta batida / excedida |

### Histórico de metas e progressão

- **Meta versionada por semana** (`Habit.goalHistory`, `rules/habit-goal-history.ts`). Editar frequência ou meta por sessão grava uma versão nova válida a partir da segunda-feira da semana atual; `habitForDate` resolve qual meta valia em cada dia. Semanas passadas, "semanas seguidas", consistência e conquistas continuam avaliadas com a meta da época. Nome, ícone, cor e categoria não são versionados.
- **Sugestão de progressão** (`rules/habit-progression.ts`), olhando só as semanas desde a última mudança de meta:
  - **Subir** após 4 semanas seguidas batendo a meta: frequência +1 até 5x/semana (hábitos flexíveis); depois, ou com dias fixos, meta por sessão +~15% (passos de 5 min a partir de 20 min; de 1 em 1 abaixo disso).
  - **Baixar** após 2 semanas seguidas abaixo: frequência para perto do que foi feito (`ceil(média)+1`, no máx. −1); sem frequência ajustável, meta por sessão −~20%.
  - Uma variável por vez. Semana que terminou ontem sem meta batida aguarda a revisão da manhã antes de contar.
  - "Aplicar" grava a nova versão da meta; "Agora não" adia por 14 dias (`progressionSnoozedUntil`). Constantes em `PROGRESSION`.
- UI: cards em **Hábitos → Evolução das metas** e no painel do hábito (com "Evolução da meta"); o formulário avisa que a mudança vale desta semana em diante.

## 5. Nota diária (0–10), explicável e versionada

`scoring/strategy-v1.ts` — média ponderada de componentes + ajustes nomeados:

| Componente | Peso | Aproveitamento |
| --- | --- | --- |
| Hábitos do dia | 5 | média do progresso dos hábitos `required` (crédito parcial: 20/30 min = 0,67) |
| Tarefas | 4 | concluídas ÷ previstas+atrasadas, ponderado por prioridade (baixa 0,5 · normal 1 · alta 2) |
| Ritmo semanal | 1 | quão perto do ritmo esperado cada hábito está |

Componentes sem itens são ignorados (o peso é redistribuído). Ajustes: **+0,3** todos os hábitos do dia, **+0,25** por hábito extra (máx. 0,75), **+0,15** por tarefa adiantada (máx. 0,45), **−0,15** por tarefa atrasada pendente (máx. −0,45). Sem nada planejado → `score = null`.

Cada `DailyRecord` guarda o `breakdown` completo e a `version`, então a fórmula pode evoluir (`SCORING_STRATEGIES`) sem reescrever o histórico. Os pesos estão centralizados no objeto `V1`.

Faixas (`scoring/tiers.ts`): Lendário ≥ 9 · Ótimo ≥ 7,5 · Bom ≥ 6 · Regular ≥ 4 · Fraco < 4. A paleta é divergente (rosa ↔ cinza neutro ↔ rampa verde ordinal), validada para contraste e daltonismo.

**Sequência**: dias encerrados com nota ≥ 6 seguidos. Dias neutros não somam nem quebram; hoje aberto e ontem aguardando revisão não quebram ("em jogo").

### Encerramento do dia e revisão da manhã

1. **Completar dia** (painel Hoje) grava o snapshot; o dia fica somente leitura até ser reaberto.
2. Se ontem ficou aberto e tinha algo planejado, ele **não** é fechado sozinho: o painel mostra o cartão **"Ontem ainda está aberto"**, com os hábitos marcados como *confirmar na manhã seguinte* (ex.: "Dormir até 23h") e o que ficou pendente. Tudo o que for marcado ali conta **para ontem** (`date = ontem`, `completedOn = ontem`). Depois, **Encerrar ontem** grava a nota.
3. Dias anteriores a ontem — ou ontem vazio — são encerrados automaticamente ao abrir o app (`closedBy: 'auto'`). Ou seja: a janela de revisão vai até o fim do dia seguinte.
4. Hábitos com `confirmNextDay` aparecem hoje com o selo "Confirmar amanhã", e o fluxo de Completar dia avisa que encerrar agora os conta como não feitos.

Regras em `services/commands.ts` (`isPendingReview`, `autoCloseMissedDays`) e `domain/rules/streaks.ts` (dia pendente não quebra).

## 6. Gamificação — preparada para recompensas

```
Ação do usuário ──► Comando ──► GameEvent ──► RewardRule[] ──► LedgerEntry[] ──► saldos / níveis / atributos / conquistas
```

- **Eventos**: `habit.session_completed`, `habit.weekly_goal_reached`, `task.completed`, `day.closed`.
- **Regras** (`gamification/rules.ts`) são declarativas: `{ event, resource, compute(event), attribute?, sourceKey }`. Hoje: +20 XP/sessão, +1 foco/minuto, +50 XP meta semanal, +5/10/20 XP por tarefa, XP = nota×10 ao encerrar, +10 ritual, +30 dia perfeito de hábitos, +100 a cada 7 dias de sequência.
- **Recursos** são strings abertas (`'xp' | 'focus' | string`) — moedas, "minutos de música" etc. entram sem migração.
- **Reversão**: `sourceKey` liga lançamentos à origem (`habitLog:<id>`, `task:<id>`, `day:<data>`, `weeklyGoal:<hábito>:<semana>`). Desfazer uma ação remove exatamente o que ela gerou.
- **Níveis**: XP total para o nível L = 80·L·(L−1). **Atributos** (Vitalidade, Intelecto, Criatividade, Espírito, Disciplina) acumulam o XP da categoria do hábito.
- **Conquistas**: definições com `progress(stats) → {current, target}` (desbloqueio + barra de progresso).
- **Tipos já definidos para o futuro**: `RewardDefinition` (custo em recursos), `ConversionRule` (ex.: 1 min de guitarra → 1 min de música).

### Como adicionar…

- **Uma recompensa nova**: acrescente uma `RewardRule` em `DEFAULT_RULES`.
- **Um recurso novo** (ex.: moedas): use um novo `resource` na regra e registre em `gamification/resources.ts`.
- **Loja**: crie `RewardDefinition[]` + um comando `redeemReward` que lança valores negativos no ledger.
- **Penalidades / energia**: regras com `amount` negativo ou novos eventos (`day.missed`).
- **Nova fórmula de nota**: implemente `ScoringStrategy` (v2) e registre em `SCORING_STRATEGIES`.
- **Backend / sync**: implemente outro `StorageAdapter` ou troque a persistência do store — os comandos continuam iguais.

## 6b. Habilidades — evolução e ferrugem

> Você não perde o que forjou. Mas aquilo que não mantém pode enferrujar.

### Conceitos (nunca confundir)

| | O que é | Sobe com | Cai? |
| --- | --- | --- | --- |
| **Nível** | Domínio histórico (vem da experiência) | Toda prática (um pouco menos quando enferrujada) | Nunca |
| **Condição** (0–100%) | Quão afiada está agora | Prática (recuperação acelerada pela maestria) | Sim, com inatividade — até o **piso** (20% padrão) |
| **Maestria** (0–100) | Consolidação de longo prazo | Prática consistente com condição ≥ 80% (retornos decrescentes) | Nunca |

### Modelo (`domain/models/skill.ts`)

- `Skill` — definição: nome, categoria (→ atributo), ícone, cor, `maintenancePerWeek`, `sessionMinutes` (duração de referência de 1 sessão), `minimumCondition?`, `startDate`.
- `SkillPractice` — fato: data, `duration` (min) / `value`+`unit`, `intensity`, `weight`, origem (`sourceHabitId`, `sourceLogId`). A quantidade real é preservada (base de recompensas por tempo).
- `HabitSkillContribution` — `habitId`, `skillId`, `weight` (1 = 100%, 0.2 = 20%…). Um hábito pode treinar várias habilidades.

Nível, experiência, condição, maestria e estado **não são armazenados**: são uma projeção determinística das práticas (como o XP é uma projeção do ledger).

### Motor (`domain/skills/engine.ts`) e balanceamento (`domain/skills/config.ts`)

`replaySkill(skill, practices, asOf)` reproduz a habilidade dia a dia, do início até `asOf`:

- **Dia com prática** — esforço = `minutos ÷ sessionMinutes` (ou `intensity`), limitado e × peso; teto diário. Aplica `calculateXpGain`, `calculateRecovery` (base × esforço × (1 + 0,8 × maestria) × redução perto de 100%) e `calculateMasteryGain`.
- **Dia sem prática** — `calculateSkillDecay` = taxa da fase de inatividade × fator de manutenção × resistência da maestria × resistência do nível × proximidade do piso. Zero na tolerância (0–2 dias) **ou** quando a janela móvel de 7 dias já tem as sessões de manutenção. O dia de hoje só enferruja depois que acaba.
- **Estado** (`calculateSkillState`, derivado): *Evoluindo* (sessões em 7 dias > manutenção) · *Mantendo* (= manutenção, ou abaixo mas dentro da tolerância — com "dias até enferrujar") · *Enferrujando* (abaixo e fora da tolerância) · *Nova*.
- Como é uma reprodução pura, o resultado em 20/10 é idêntico tenha o app sido aberto todo dia ou não; e o mesmo processo gera o **histórico diário** (gráfico de 30 dias, tendência semanal ↑ → ↓).

Todos os números (tolerância, fases, taxas, resistências, ganhos, curva de nível `60·(L−1)^1,6`, limiares de maestria) ficam em `SKILL_CONFIG`; as funções aceitam uma configuração alternativa (testes, futuros modos de jogo). Referência de balanceamento (3 sessões/semana): 3 meses → nível 5; 1 ano → nível 12, maestria ~57; 30 dias parado depois de 1 ano → condição ~88%; depois de 4 semanas de prática → ~50%.

> Trade-off consciente: como o estado é reproduzido, mudar `SKILL_CONFIG`, a manutenção ou a duração de referência de uma habilidade recalcula o histórico dela. Se isso precisar ser "congelado", basta versionar esses parâmetros como já é feito com as metas dos hábitos.

### Aplicação (`services/skill-commands.ts`, `services/skill-sync.ts`)

- Registrar um hábito vinculado cria/atualiza/remove as práticas daquele registro (inclusive progresso parcial: 15 de 30 min = meia sessão). Desmarcar desfaz.
- Vincular um hábito importa o histórico existente dele; desvincular preserva as práticas já feitas. Excluir o hábito remove as práticas geradas por ele.
- "Registrar prática" na habilidade usa o **hábito principal** (vínculo 100%) quando existe — a prática conta também para o dia, sem lançamento duplo; senão vira prática avulsa.
- Eventos `skill.practiced` e `skill.level_up` passam pelo mesmo motor de regras do ledger: hoje, +25 XP de personagem por nível de habilidade e +1 de foco por minuto em prática avulsa. Recompensas futuras ("1 min de guitarra = 1 min de música", "7 dias mantendo") são novas regras sobre esses eventos. Recompensas de nível são sincronizadas de forma idempotente com o nível atual.
- A nota diária **não** é afetada: dia = desempenho do dia; habilidade = evolução de longo prazo.

### Interface

Aba **Habilidades** (bigorna) com cards — nível, condição com marca do piso, estado, sessões em 7 dias, última prática e "+ Prática" (sheet com 15/30/45/60/personalizado em um toque). A ferrugem é visual e sutil (`--rust` no card: menos saturação, barra puxando para o cobre, pátina no canto). Detalhe com nível/condição/maestria lado a lado, explicação do estado ("por que" e "o que fazer"), gráfico de 30 dias com o piso, tendência semanal, hábitos que treinam e práticas recentes. No Hoje, no máximo um aviso gentil por dia ("Guitarra está começando a enferrujar…"). Feedback de prática no toast ("Guitarra +4% condição · Nv 4 · +18 XP", "Recuperando…", "Novo nível!"). No celular o Perfil fica no avatar do topo.

## 7. Estados cobertos

Primeiro acesso (onboarding) · ontem aguardando revisão · sem hábitos (sugestões) · sem tarefas · dia em branco · dia não iniciado / em andamento / tudo feito (CTA destacado) / encerrado (somente leitura + reabrir) · hábito atrasado / em risco / adiantado / meta batida / excedida · tarefa atrasada (penalidade explicada) · sequência quebrada (aviso gentil, dispensável) · dia sem plano (neutro no calendário) · semana futura / passada · armazenamento indisponível (fallback em memória) · backup inválido.

## 8. UX e acessibilidade

Navegação inferior no celular, sidebar a partir de 768 px; bottom sheets no celular e diálogos no desktop; alvos de toque ≥ 44 px; toasts com XP e "Desfazer"; animações curtas (respeitam `prefers-reduced-motion`); rótulos ARIA em checkboxes e gráficos; gráficos com tabela alternativa; dark mode desenhado (não invertido).

## 9. Testes

`npm test` cobre habilidades (evolução, manutenção, tolerância, fases de ferrugem, piso, maestria × retenção, recuperação, determinismo, vínculos com hábitos, prática avulsa, recompensas de nível), datas, ritmo de hábitos, agenda de tarefas, fórmula da nota, sequências, regras de XP, comandos (desfazer, meta semanal, encerrar/reabrir dia, auto-encerramento) e consistência dos dados de exemplo.
