/**
 * Balanceamento do sistema de habilidades — TODO número do jogo mora aqui.
 * Alterar estes valores rebalanceia o sistema sem mexer em código.
 */
export const SKILL_CONFIG = {
  /** Faixa de condição. */
  MAX_CONDITION: 100,
  MINIMUM_CONDITION: 20,
  /** Condição de uma habilidade recém-criada (ainda "fria"). */
  INITIAL_CONDITION: 25,

  /* ---------------- Sessões ---------------- */
  /** Janela (dias) usada para medir a frequência de manutenção. */
  MAINTENANCE_WINDOW_DAYS: 7,
  /** Esforço máximo contado por dia (evita "maratonas" compensarem a semana). */
  MAX_DAILY_EFFORT: 2,
  /** Um dia conta no máximo como 1 sessão para a frequência de manutenção. */
  MAX_DAILY_SESSIONS: 1,
  /**
   * Prática válida para manutenção (hábitos em minutos, regras v2):
   * mínimo = mín(meta, máx(MIN_MINUTES, ⌈meta × RATIO⌉)). Abaixo disso a
   * prática ainda evolui a habilidade, mas não conta como sessão.
   */
  MAINTENANCE_MIN_RATIO: 0.25,
  MAINTENANCE_MIN_MINUTES: 5,
  /** Limites do esforço de uma prática v1 / avulsa (minutos ÷ sessão de referência). */
  MIN_PRACTICE_EFFORT: 0.25,
  MAX_PRACTICE_EFFORT: 2,

  /* ---------------- Ferrugem (decay) ---------------- */
  /** Dias sem prática sem nenhuma ferrugem. */
  DECAY_GRACE_PERIOD: 2,
  /**
   * Taxa base (pontos de condição/dia) por fase de inatividade.
   * `fromDay` = dias desde a última prática a partir dos quais a fase vale.
   */
  DECAY_PHASES: [
    { fromDay: 3, rate: 0.8, label: 'leve' },
    { fromDay: 8, rate: 1.2, label: 'moderada' },
    { fromDay: 22, rate: 1.6, label: 'maior' },
    { fromDay: 61, rate: 0.4, label: 'desacelerada' },
  ],
  /** Manutenção de referência: acima dela a habilidade enferruja mais rápido. */
  REFERENCE_MAINTENANCE: 3,
  /** Expoente do fator de manutenção ((manutenção ÷ referência)^x). */
  MAINTENANCE_DECAY_EXPONENT: 0.5,
  /** Maestria 100 reduz a ferrugem em até 70%. */
  MASTERY_DECAY_RESISTANCE: 0.7,
  /** Cada nível acima do 1 dá um pouco de resistência (1 / (1 + x·(nível−1))). */
  LEVEL_DECAY_RESISTANCE: 0.02,
  /** Perto do piso a ferrugem desacelera: fator = mín + (1 − mín)·(posição acima do piso). */
  FLOOR_PROXIMITY_MIN_FACTOR: 0.35,

  /* ---------------- Condição: prática e recuperação ---------------- */
  /** Pontos de condição por sessão (esforço 1) numa habilidade sem maestria. */
  BASE_CONDITION_GAIN: 3.5,
  /** Maestria 100 multiplica a recuperação por (1 + x): "memória muscular". */
  RECOVERY_MULTIPLIER: 0.8,
  /** Abaixo de (MAX − faixa), o ganho é cheio; acima, diminui até o mínimo. */
  CONDITION_TAPER_RANGE: 25,
  CONDITION_TAPER_MIN: 0.2,

  /* ---------------- Experiência e nível ---------------- */
  XP_PER_PRACTICE: 20,
  /** Praticar enferrujado rende menos XP (parte da prática vai para recuperar). */
  XP_RUSTY_FACTOR_MIN: 0.6,
  /** XP total para alcançar o nível L = LEVEL_XP_BASE · (L − 1)^LEVEL_XP_EXPONENT. */
  LEVEL_XP_BASE: 60,
  LEVEL_XP_EXPONENT: 1.6,

  /* ---------------- Maestria ---------------- */
  /** Ganho por sessão (com retornos decrescentes: × (1 − maestria/100)). */
  MASTERY_GAIN_PER_PRACTICE: 0.6,
  /** Só consolida com a habilidade afiada… */
  MASTERY_CONDITION_THRESHOLD: 80,
  /** …e com prática consistente (sessões na janela ≥ manutenção). */
  MASTERY_REQUIRES_MAINTENANCE: true,
  MAX_MASTERY: 100,

  /* ---------------- Histórico / UI ---------------- */
  /** Dias de histórico diário mantidos na projeção (para gráficos). */
  HISTORY_DAYS: 120,
} as const

type Widen<T> = T extends number
  ? number
  : T extends boolean
    ? boolean
    : T extends string
      ? string
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : T extends object
          ? { readonly [K in keyof T]: Widen<T[K]> }
          : T

/** Tipo da configuração (permite variações em testes e futuros "modos de jogo"). */
export type SkillConfig = Widen<typeof SKILL_CONFIG>
