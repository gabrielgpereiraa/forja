/**
 * Tradução de `Feedback` (domínio) em feedback visual: toasts discretos com
 * XP, metas e conquistas. Mantido fora das páginas para ser reutilizado.
 */
import { toast } from 'sonner'
import { Award, Check, Sparkles, Target, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { HABIT_ICONS, habitColorStyle } from '@/components/appearance'
import type { Feedback } from '@/services/commands'
import type { SkillFeedback } from '@/services/skill-sync'

/** Recompensa efetivamente concedida: "+20 XP" ou "+10 Foco" (nada quando zero). */
function RewardChip({ amount, kind }: { amount: number; kind: 'xp' | 'focus' }) {
  if (amount === 0 || (kind === 'focus' && amount < 0)) return null
  return (
    <span
      className={
        kind === 'xp'
          ? 'shrink-0 rounded-md bg-xp/15 px-1.5 py-0.5 text-[12px] font-semibold text-xp tabular'
          : 'shrink-0 rounded-md bg-primary/12 px-1.5 py-0.5 text-[12px] font-semibold text-primary tabular'
      }
    >
      {amount > 0 ? '+' : ''}
      {amount} {kind === 'xp' ? 'XP' : 'Foco'}
    </span>
  )
}

/** Linha principal do aviso. `min-w-0 flex-1` (não `w-full`): divide a largura com o botão "Desfazer" sem empurrá-lo para fora. */
function Row({ icon, title, sub, xp, focus }: { icon: ReactNode; title: string; sub?: string; xp?: number; focus?: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{title}</div>
        {sub && <div className="truncate text-[12px] text-muted-foreground">{sub}</div>}
      </div>
      {(xp || focus) ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {focus !== undefined && <RewardChip amount={focus} kind="focus" />}
          {xp !== undefined && <RewardChip amount={xp} kind="xp" />}
        </span>
      ) : null}
    </div>
  )
}

/** Linha compacta da habilidade mais afetada: "Guitarra +4% condição · +18 XP". */
function SkillStrip({ item }: { item: SkillFeedback }) {
  const { delta, skill } = item
  const gain = delta.conditionAfter - delta.conditionBefore
  const Icon = HABIT_ICONS[skill.icon]
  const recovering = delta.recovering && gain > 0
  return (
    <div style={habitColorStyle(skill.color)} className="habit-color mt-2.5 flex items-center gap-2 border-t pt-2.5 text-[12px]">
      <Icon className="size-3.5 shrink-0 text-[var(--hc)]" />
      <span className="min-w-0 truncate">
        {recovering ? <span className="text-muted-foreground">Recuperando · </span> : null}
        <span className="font-medium">{skill.name}</span>
        {gain >= 0.5 && <span className="text-muted-foreground"> +{Math.round(gain)}% condição</span>}
      </span>
      {delta.xpGained >= 0.5 && (
        <span className="ml-auto shrink-0 text-muted-foreground tabular" title="Experiência da habilidade">
          Nv {delta.levelAfter} · +{Math.round(delta.xpGained)} XP
        </span>
      )}
    </div>
  )
}

/**
 * Aviso de uma ação: mostra só o que foi concedido (XP de sessão/tarefa, Foco)
 * e, quando informada, a variação da nota até agora (`note`) — que não é XP.
 */
export function notifyFeedback(feedback: Feedback, opts: { title: string; sub?: string; note?: string; undo?: () => void }) {
  const goal = feedback.events.includes('habit.weekly_goal_reached')
  const top = feedback.skills[0]
  toast.custom(
    () => (
      <div className="w-full">
        <div className="flex w-full items-center gap-3">
          <Row
            icon={goal ? <Target /> : <Check strokeWidth={3} />}
            title={goal ? 'Meta semanal atingida!' : opts.title}
            sub={goal ? opts.title : opts.sub}
            xp={feedback.xp}
            focus={feedback.focus}
          />
          {opts.undo && (
            <button
              type="button"
              onClick={() => {
                opts.undo?.()
                toast.dismiss()
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Desfazer
            </button>
          )}
        </div>
        {opts.note && <div className="mt-1.5 pl-11 text-[12px] text-muted-foreground tabular">{opts.note}</div>}
        {top && <SkillStrip item={top} />}
      </div>
    ),
    { duration: 2800 },
  )
  notifyProgression(feedback)
}

export function notifyProgression(feedback: Feedback) {
  if (feedback.levelUp) {
    const level = feedback.levelUp
    toast.custom(
      () => (
        <div className="flex w-full items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-xp/15 text-xp">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <div className="text-[14px] font-semibold">Nível {level} alcançado</div>
            <div className="text-[12px] text-muted-foreground">Seu personagem evoluiu.</div>
          </div>
        </div>
      ),
      { duration: 3500 },
    )
  }
  for (const item of feedback.skills.filter((i) => i.delta.levelAfter > i.delta.levelBefore)) {
    const Icon = HABIT_ICONS[item.skill.icon]
    toast.custom(
      () => (
        <div style={habitColorStyle(item.skill.color)} className="habit-color flex w-full items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--hc)_16%,transparent)] text-[var(--hc)]">
            <Icon className="size-4" />
          </span>
          <div>
            <div className="text-[14px] font-semibold">Novo nível!</div>
            <div className="text-[12px] text-muted-foreground">
              {item.skill.name} — Nível {item.delta.levelAfter}
            </div>
          </div>
        </div>
      ),
      { duration: 3500 },
    )
  }
  for (const a of feedback.achievements) {
    toast.custom(
      () => (
        <div className="flex w-full items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-xp/15 text-xp">
            <Award className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold">
              Conquista: {a.title} <Sparkles className="size-3.5 text-xp" />
            </div>
            <div className="truncate text-[12px] text-muted-foreground">{a.description}</div>
          </div>
        </div>
      ),
      { duration: 3500 },
    )
  }
}
