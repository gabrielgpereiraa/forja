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
│   ├── storage.ts          StorageAdapter (localStorage c/ fallback em memória, escopo por usuário)
│   ├── sync/               sincronização local-first com o Supabase (ver §6c)
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
| `DailyRecord` | `date, score\|null, breakdown, completed/total habits & tasks, closedBy, awaitingConfirmation?, lateConfirmations?` | imutável, exceto pela confirmação tardia; `score = null` = dia sem plano (neutro) |
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

Componentes sem itens são ignorados (o peso é redistribuído). Ajustes: **+0,3** todos os hábitos do dia, **+0,25** por hábito extra (máx. 0,75), **+0,15** por tarefa adiantada (máx. 0,45), **−0,15** por tarefa atrasada pendente (máx. −0,45). Sem nada planejado (nenhum hábito obrigatório nem tarefa do dia/atrasada) → `score = null`, mesmo que haja hábitos extras ou tarefas adiantadas: extras mantêm só suas recompensas próprias (sessão, Foco, tarefa) e não geram nota, XP de nota nem sequência.

Cada `DailyRecord` guarda o `breakdown` completo e a `version`, então a fórmula pode evoluir (`SCORING_STRATEGIES`) sem reescrever o histórico. Os pesos estão centralizados no objeto `V1`.

Faixas (`scoring/tiers.ts`): Lendário ≥ 9 · Ótimo ≥ 7,5 · Bom ≥ 6 · Regular ≥ 4 · Fraco < 4. A paleta é divergente (rosa ↔ cinza neutro ↔ rampa verde ordinal), validada para contraste e daltonismo.

**Sequência**: dias encerrados com nota ≥ 6 seguidos. Dias neutros não somam nem quebram; hoje aberto e ontem aguardando revisão não quebram ("em jogo").

### Encerramento do dia e revisão da manhã

1. **Completar dia** (painel Hoje) grava o snapshot; o dia fica somente leitura até ser reaberto.
2. Se ontem ficou aberto e tinha algo planejado, ele **não** é fechado sozinho: o painel mostra o cartão **"Ontem ainda está aberto"**, com **somente** os hábitos marcados como *confirmar na manhã seguinte* (ex.: "Dormir até 23h"); hábitos comuns e tarefas pendentes não entram (`habitsForMorningReview`) — tarefas pendentes aparecem hoje como atrasadas. O que for marcado ali conta **para ontem** (`date = ontem`). Depois, **Encerrar ontem** grava a nota. Encerrar pela revisão é definitivo: hábitos com a flag que ficaram desmarcados contam como **não cumpridos** e não abrem a confirmação tardia (a revisão já era esse momento); o modal de encerramento avisa quais são.
3. Dias anteriores a ontem — ou ontem vazio — são encerrados automaticamente ao abrir o app (`closedBy: 'auto'`). Ou seja: a janela de revisão vai até o fim do dia seguinte.
4. Hábitos com `confirmNextDay` aparecem com o selo "Confirmar amanhã". Encerrar o dia sem marcá-los é normal: veja a confirmação tardia abaixo.

Regras em `services/commands.ts` (`isPendingReview`, `autoCloseMissedDays`) e `domain/rules/streaks.ts` (dia pendente não quebra).

### Restrições de datas (sem edição retroativa)

Validadas na camada de serviços (não só na interface). O store passa o dia de produtividade atual (`today`) aos comandos:

- `setHabitValue`/`toggleHabit`: dia encerrado nunca; com `today`, só **hoje** ou **ontem ainda aberto para hábitos com `confirmNextDay`** (`canWriteHabitOn`). Datas futuras ou mais antigas são ignoradas. A outra exceção é `confirmLateHabit`.
- `setTaskCompleted`: não conclui tarefa num dia encerrado, não reabre tarefa concluída num dia encerrado (`isTaskLocked`, também usado pela aba Tarefas e pelo formulário) e, com `today`, só conclui em hoje (`canChangeTask`).
- Sem `today` (dados de exemplo, testes de histórico) vale apenas o bloqueio de dia encerrado.

### Confirmação tardia ("Confirmar na manhã seguinte")

Dia encerrado **não é reaberto** e continua bloqueado (`setHabitValue` ignora datas com registro). A única exceção é controlada:

- **Quando:** só para dias encerrados **dentro do próprio dia** (à noite) ou encerrados sozinhos (ontem vazio, sem revisão). Dia encerrado pelo usuário depois de acabar (revisão da manhã) grava `awaitingConfirmation = []` (`closeDay(…, today)`).
- **Quem:** só os hábitos que tinham `confirmNextDay` e estavam em aberto **no momento do encerramento**. A lista fica congelada no registro (`DailyRecord.awaitingConfirmation`); ligar a flag depois não libera nada. Registros antigos, sem a lista, usam a flag atual.
- **Quando:** enquanto o dia encerrado é "ontem" — até o início do dia seguinte (`settings.dayStartHour`, padrão 04:00). Depois disso o registro é definitivo.
- **O quê:** confirmar (ou desfazer uma confirmação tardia). A conclusão grava o log **no dia anterior**; o registro é recalculado (nota, hábitos concluídos, breakdown), as recompensas `day:<data>` são regeradas (XP da nota, "todos os hábitos", marco de sequência) e, se hoje já estiver encerrado, as de hoje também, porque a sequência depende de ontem. `closedAt`/`closedBy` não mudam.
- **Auditoria:** `DailyRecord.lateConfirmations` guarda hábito, horário e o valor anterior (para desfazer sem perder progresso parcial). O detalhe do dia mostra "confirmado depois".
- **Onde:** cartão "Confirme o que só dava para saber hoje" no painel Hoje (dispensável com "Não cumpri") e o painel do hábito aberto a partir dele. Também cobre o dia vazio encerrado sozinho, se o hábito estava como opcional.

Regras em `domain/rules/late-confirmation.ts` (`lateConfirmationCandidates`, `eligibleLateHabitIds`) e `services/commands.ts` (`confirmLateHabit`).

## 6. Gamificação — preparada para recompensas

```
Ação do usuário ──► Comando ──► GameEvent ──► RewardRule[] ──► LedgerEntry[] ──► saldos / níveis / atributos / conquistas
```

- **Eventos**: `habit.session_completed`, `habit.progress_recorded` (registro com valor > 0, concluído ou parcial), `habit.weekly_goal_reached`, `task.completed`, `day.closed`, `skill.practiced`, `skill.level_up`.
- **Regras** (`gamification/rules.ts`) são declarativas: `{ event, resource, compute(event), attribute?, sourceKey }`. Hoje: +20 XP/sessão concluída (inclusive extras depois da meta), +1 Foco por minuto **realizado** em hábitos de tempo (vale o valor atual do registro, mesmo parcial; editar substitui, não soma), +50 XP meta semanal (uma vez por semana), +5/10/20 XP por tarefa, XP = nota×10 ao encerrar, +10 ritual, +30 dia perfeito de hábitos, +100 a cada 7 dias de sequência.
- **Recursos** são strings abertas (`'xp' | 'focus' | string`) — moedas, "minutos de música" etc. entram sem migração.
- **Reversão**: `sourceKey` liga lançamentos à origem (`habitLog:<id>`, `task:<id>`, `day:<data>`, `weeklyGoal:<hábito>:<semana>`). Desfazer uma ação remove exatamente o que ela gerou.
- **Níveis**: XP total para o nível L = 80·L·(L−1). **Atributos** (Vitalidade, Intelecto, Criatividade, Espírito, Disciplina) acumulam o XP da categoria do hábito.
- **Conquistas**: definições com `progress(stats) → {current, target}` (desbloqueio + barra de progresso). Desbloqueio é definitivo e nunca é removido. É avaliado sobre os **dados consolidados** (`consolidatedData`/`unlockAchievements` em `services/commands.ts`): confirmações tardias que ainda podem ser desfeitas (o dia é "ontem") são revertidas antes do cálculo, então o que depende delas só é validado quando a janela fecha — na próxima ação ou ao abrir o app (`autoCloseMissedDays`). O que foi atingido no encerramento não espera (a confirmação tardia só pode subir a nota).
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
- `SkillPractice` — fato: data, `duration` (min) / `value`+`unit`, `intensity`, `weight`, origem (`sourceHabitId`, `sourceLogId`), `rulesVersion?`/`targetMinutes?` (regras v2, ver abaixo). A quantidade real é preservada (base de recompensas por tempo).
- `HabitSkillContribution` — `habitId`, `skillId`, `weight` (1 = 100%, 0.2 = 20%…). Um hábito pode treinar várias habilidades.

Nível, experiência, condição, maestria e estado **não são armazenados**: são uma projeção determinística das práticas (como o XP é uma projeção do ledger).

### Motor (`domain/skills/engine.ts`) e balanceamento (`domain/skills/config.ts`)

`replaySkill(skill, practices, asOf)` reproduz a habilidade dia a dia, do início até `asOf`:

- **Esforço (evolução)** — `practiceEffort`. Práticas v2 de hábitos em minutos: `mín(1, minutos ÷ meta do hábito na data) × peso` (60 de 30 min = 1 sessão). Avulsas, metas que não são tempo e práticas v1: `minutos ÷ sessionMinutes` (ou `intensity`), limitado a 0,25–2, × peso. Teto diário de 2. XP interno = 20 × esforço × fator de ferrugem (0,6–1, já existente); condição = `calculateRecovery` (base × esforço × (1 + 0,8 × maestria) × redução perto de 100%); maestria = `calculateMasteryGain`.
- **Frequência (manutenção)** — separada do esforço e **independente do peso**: cada dia com ao menos uma prática válida vale 1 crédito na janela de 7 dias (duas no mesmo dia = 1; práticas abaixo do mínimo não se somam). Prática válida (`isMaintenancePractice`): em minutos, `≥ mín(meta, máx(5, ⌈meta × 0,25⌉))` (`maintenanceMinimum`; 30 min → 8, 60 → 15); binária ou com outra unidade (páginas, km), só concluída; avulsas e práticas v1, sempre. Parâmetros em `SKILL_CONFIG.MAINTENANCE_MIN_RATIO`/`MAINTENANCE_MIN_MINUTES`.
- **Dia sem prática válida** — `calculateSkillDecay` = taxa da fase de inatividade × fator de manutenção × resistência da maestria × resistência do nível × proximidade do piso. Zero na tolerância (0–2 dias) **ou** quando a janela móvel de 7 dias já tem as sessões de manutenção. A inatividade conta desde a **última prática válida**: uma prática abaixo do mínimo evolui a habilidade, mas não zera essa contagem (o dia pode ter ganho proporcional e ferrugem). O dia de hoje só enferruja depois que acaba. O snapshot expõe `lastPracticedOn`/`daysSinceLast` (qualquer prática) e `lastValidPracticeOn`/`daysSinceValid` (base da ferrugem).
- **Estado** (`calculateSkillState`, derivado): *Evoluindo* (sessões em 7 dias > manutenção) · *Mantendo* (= manutenção, ou abaixo mas dentro da tolerância — com "dias até enferrujar") · *Enferrujando* (abaixo e fora da tolerância) · *Nova*.
- Como é uma reprodução pura, o resultado em 20/10 é idêntico tenha o app sido aberto todo dia ou não; e o mesmo processo gera o **histórico diário** (gráfico de 30 dias, tendência semanal ↑ → ↓).

Todos os números (tolerância, fases, taxas, resistências, ganhos, curva de nível `60·(L−1)^1,6`, limiares de maestria) ficam em `SKILL_CONFIG`; as funções aceitam uma configuração alternativa (testes, futuros modos de jogo). Referência de balanceamento (3 sessões/semana): 3 meses → nível 5; 1 ano → nível 12, maestria ~57; 30 dias parado depois de 1 ano → condição ~88%; depois de 4 semanas de prática → ~50%.

> Trade-off consciente: como o estado é reproduzido, mudar `SKILL_CONFIG`, a manutenção ou a duração de referência de uma habilidade recalcula o histórico dela. Se isso precisar ser "congelado", basta versionar esses parâmetros como já é feito com as metas dos hábitos.

**Versionamento das regras de prática.** `SkillPractice.rulesVersion = 2` (+ `targetMinutes`, a meta da sessão vigente na data, respeitando o histórico de metas) marca as práticas criadas a partir da evolução proporcional. Práticas sem o campo (v1) mantêm a fórmula de esforço antiga e sempre contam como prática válida; só a contagem de manutenção por dia, independente do peso, vale para todo o histórico. Verificado nos dados de exemplo: nenhum nível muda e condição/maestria ficam iguais ou maiores, então nenhuma recompensa de nível é removida. Foco parcial vale a partir desta versão (registros parciais antigos não recebem Foco retroativo).

### Aplicação (`services/skill-commands.ts`, `services/skill-sync.ts`)

- Registrar um hábito vinculado cria/atualiza/remove as práticas daquele registro (inclusive progresso parcial: 15 de 30 min = meia sessão de evolução; 15 ≥ 8 conta para manutenção). Desmarcar desfaz.
- Vincular um hábito importa o histórico existente dele; desvincular preserva as práticas já feitas. Excluir o hábito remove as práticas geradas por ele.
- "Registrar prática" na habilidade usa o **hábito principal** (vínculo 100%) quando existe — a prática conta também para o dia, sem lançamento duplo; senão vira prática avulsa.
- Eventos `skill.practiced` e `skill.level_up` passam pelo mesmo motor de regras do ledger: hoje, +25 XP de personagem por nível de habilidade e +1 de foco por minuto em prática avulsa. Recompensas futuras ("1 min de guitarra = 1 min de música", "7 dias mantendo") são novas regras sobre esses eventos. Recompensas de nível são sincronizadas de forma idempotente com o nível **do replay até hoje** (`commitSkillChanges` recebe a data de referência atual): um registro do dia anterior (confirmação tardia ou revisão da manhã) não apaga recompensas de níveis alcançados depois.
- A nota diária **não** é afetada: dia = desempenho do dia; habilidade = evolução de longo prazo.

### Interface

Aba **Habilidades** (bigorna) com cards — nível, condição com marca do piso, estado, sessões em 7 dias, última prática e "+ Prática" (sheet com 15/30/45/60/personalizado em um toque). A ferrugem é visual e sutil (`--rust` no card: menos saturação, barra puxando para o cobre, pátina no canto). Detalhe com nível/condição/maestria lado a lado, explicação do estado ("por que" e "o que fazer"), gráfico de 30 dias com o piso, tendência semanal, hábitos que treinam e práticas recentes. No Hoje, no máximo um aviso gentil por dia ("Guitarra está começando a enferrujar…"). Feedback de prática no toast ("Guitarra +4% condição · Nv 4 · +18 XP", "Recuperando…", "Novo nível!"). No celular o Perfil fica no avatar do topo.

## 6c. Contas e nuvem (Supabase + Google)

**Peças:** Supabase Auth (provedor Google, fluxo PKCE) · Postgres com Row Level Security · app estático na Vercel. Sem `VITE_SUPABASE_*` no ambiente o app roda no **modo local** da v1 (útil para dev/testes).

### Banco (`supabase/migrations/0001_init.sql`)
Uma tabela por tipo de entidade — `profiles` (perfil + ajustes, id `main`), `habits`, `habit_logs`, `tasks`, `day_records` (id = data), `ledger_entries`, `achievements`, `skills`, `skill_practices`, `skill_links` (id = `habitId:skillId`) — todas com o mesmo formato:

| coluna | papel |
| --- | --- |
| `user_id` | dono (FK `auth.users`, `on delete cascade`) |
| `id` | id da entidade no app |
| `data` | o objeto do domínio, exatamente como no app (jsonb) |
| `updated_at` | definido pelo servidor (trigger) — cursor da sincronização |
| `deleted_at` | exclusão lógica, para propagar entre aparelhos |

RLS em todas: `select/insert/update/delete` só quando `auth.uid() = user_id`; `anon` sem acesso. A chave *publishable* no site é pública por design.

> Por que `data jsonb` e não colunas? O domínio evolui rápido (metas versionadas, habilidades…). Guardar o objeto inteiro evita uma migração de banco a cada campo novo — as migrações continuam no app (`migrateData`). Se um dia houver relatórios no servidor, dá para criar colunas geradas/visões sobre o jsonb.

### Sincronização (`services/sync/`)
- `collections.ts` (puro): `diffData(prev, next)` compara por **referência** (os comandos são imutáveis) e gera mudanças por entidade; `applyRows` aplica linhas recebidas sem recriar o estado quando nada muda.
- `engine.ts` — `SyncEngine`: observa o store, põe mudanças numa **caixa de saída persistida** (`forja.sync.<uid>.outbox`), envia em lote (upsert) com *retry* exponencial; baixa por cursor `updated_at` (com 60 s de folga) a cada 2 min, ao voltar ao app e ao reconectar. Entidade com envio pendente mantém a versão local. Conflito: última escrita que chega ao servidor vence, por entidade.
- `supabase-remote.ts`: implementação do `RemoteStore` (paginação de 1000, lotes de 400).
- O motor não conhece React nem Supabase — os testes usam um servidor em memória com dois "aparelhos".

### Sessão (`features/auth/`)
`AuthGate` → sem sessão: `LoginPage` · com sessão: aponta o store para `forja.data.<uid>` (`switchDataScope`), faz a primeira carga e libera o app. Aparelho novo sem resposta do servidor → tela "tentar de novo" (nunca começa do zero por cima da nuvem). Conta vazia + dados da v1 neste navegador → `ImportPrompt`. Sair: envia o pendente (avisa se não conseguir) e apaga o cache local daquela conta. `/privacidade` e `/termos` são públicas (exigidas pela tela de consentimento do Google).

### Configuração (contas pessoais, fora da NX)
- **Supabase:** projeto `forja-habits-tracker` (org gabrielgpereiraa, us-west-2). Auth → Google habilitado; URL Configuration com o domínio da Vercel e `http://localhost:5180`.
- **Google Cloud:** projeto `Forja` (`forja-510812`, conta gabrielg.pereira@outlook.com), público Externo, escopos básicos (`openid email profile`), cliente Web com redirect `https://<ref>.supabase.co/auth/v1/callback`.
- **Vercel:** importa `gabrielgpereiraa/forja`; variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; `vercel.json` reescreve rotas para o SPA.

## 7. Estados cobertos

Primeiro acesso (onboarding) · ontem aguardando revisão · sem hábitos (sugestões) · sem tarefas · dia em branco · dia não iniciado / em andamento / tudo feito (CTA destacado) / encerrado (somente leitura + reabrir) · hábito atrasado / em risco / adiantado / meta batida / excedida · tarefa atrasada (penalidade explicada) · sequência quebrada (aviso gentil, dispensável) · dia sem plano (neutro no calendário) · semana futura / passada · armazenamento indisponível (fallback em memória) · backup inválido.

## 8. UX e acessibilidade

Navegação inferior no celular, sidebar a partir de 768 px; bottom sheets no celular e diálogos no desktop; alvos de toque ≥ 44 px; toasts com XP e "Desfazer"; animações curtas (respeitam `prefers-reduced-motion`); rótulos ARIA em checkboxes e gráficos; gráficos com tabela alternativa; dark mode desenhado (não invertido).

## 9. Testes

`npm test` cobre habilidades (evolução, manutenção, tolerância, fases de ferrugem, piso, maestria × retenção, recuperação, determinismo, vínculos com hábitos, prática avulsa, recompensas de nível), datas, ritmo de hábitos, agenda de tarefas, fórmula da nota, sequências, regras de XP, comandos (desfazer, meta semanal, encerrar/reabrir dia, auto-encerramento, confirmação tardia) e consistência dos dados de exemplo. `services/__tests__/progression-spec.test.ts` reúne os testes de aceitação da especificação de progressão (Foco parcial, evolução proporcional, manutenção válida e independente do peso, nota de dias sem plano, dias encerrados, recompensas de nível na confirmação tardia, conquistas consolidadas e determinismo do replay).
