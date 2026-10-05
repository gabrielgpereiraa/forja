import type { CSSProperties } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Link2, Pencil, Plus, Trash2 } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { ProgressBar } from '@/components/progress/progress-bar'
import { ProgressRing } from '@/components/progress/progress-ring'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { formatDate, relativeDayLabel } from '@/domain/date'
import { weeklyTrend } from '@/domain/skills/engine'
import { useSkillViews } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn, formatNumber } from '@/lib/utils'
import { practiceLabel } from '@/services/skill-commands'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { SkillStatusChip } from './SkillCard'
import { SkillConditionChart } from './SkillConditionChart'
import { explainStatus, rustLevel } from './skill-format'

const WEIGHT_LABEL = (w: number) => `${Math.round(w * 100)}%`

export function SkillDetailModal() {
  const skillId = useUiStore((s) => s.skillDetail)
  const close = useUiStore((s) => s.closeSkillDetail)
  const openSkillForm = useUiStore((s) => s.openSkillForm)
  const openPracticeSheet = useUiStore((s) => s.openPracticeSheet)
  const habits = useAppStore((s) => s.habits)
  const practices = useAppStore((s) => s.skillPractices)
  const removePractice = useAppStore((s) => s.removeSkillPractice)
  const today = useToday()
  const views = useSkillViews(today)
  const view = views.find((v) => v.skill.id === skillId)
  if (!view) return null

  const { skill, snapshot: s, links } = view
  const rust = rustLevel(s)
  const explain = explainStatus(skill, s)
  const last30 = s.history.slice(-30)
  const trend = weeklyTrend(s.history, 6)
  const recent = practices
    .filter((p) => p.skillId === skill.id && p.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return (
    <ResponsiveModal
      open
      onOpenChange={(o) => !o && close()}
      title={
        <span className="flex items-center gap-3">
          <HabitGlyph icon={skill.icon} color={skill.color} />
          <span className="min-w-0">
            <span className="block truncate">{skill.name}</span>
            <span className="block text-[13px] font-normal text-muted-foreground">
              Manutenção: {skill.maintenancePerWeek}x por semana · sessão de {skill.sessionMinutes} min
            </span>
          </span>
        </span>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => { close(); openSkillForm(skill.id) }}>
            <Pencil /> Editar
          </Button>
          <Button className="flex-1" onClick={() => { close(); openPracticeSheet(skill.id) }}>
            <Plus /> Registrar prática
          </Button>
        </div>
      }
    >
      <div style={{ ...habitColorStyle(skill.color), '--rust': rust } as CSSProperties} className="habit-color skill-card space-y-5 pb-1">
        {skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}

        {/* Domínio · Condição · Maestria — três coisas diferentes */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-surface p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Nível</div>
            <div className="mt-1 font-display text-2xl leading-none font-semibold">{s.level}</div>
            <ProgressBar value={s.levelInfo.progress} size="xs" className="mt-2" barClassName="bg-[var(--hc)]" label="Progresso de nível" />
            <div className="mt-1 text-[10px] text-muted-foreground tabular">
              {Math.round(s.levelInfo.current)}/{Math.round(s.levelInfo.required)} XP
            </div>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-surface p-3">
            <div className="self-start text-[11px] font-medium text-muted-foreground uppercase">Condição</div>
            <ProgressRing value={s.condition / 100} size={58} stroke={6} color="var(--skill-bar)" className="mt-1">
              <span className="font-display text-[15px] font-semibold tabular">{Math.round(s.condition)}%</span>
            </ProgressRing>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Maestria</div>
            <div className="mt-1 font-display text-2xl leading-none font-semibold">{Math.floor(s.mastery)}</div>
            <ProgressBar value={s.mastery / 100} size="xs" className="mt-2" barClassName="bg-xp" label="Maestria" />
            <div className="mt-1 text-[10px] text-muted-foreground">de 100</div>
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-3.5 text-[13px]',
            s.status === 'rusting' ? 'border-[color-mix(in_oklch,var(--rust-color)_35%,transparent)] bg-[color-mix(in_oklch,var(--rust-color)_7%,transparent)]' : 'bg-card',
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium">{explain.title}</span>
            <SkillStatusChip status={s.status} />
          </div>
          <p className="leading-snug text-muted-foreground">{explain.body}</p>
        </div>

        {last30.length > 1 && (
          <section>
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-medium">Condição · últimos {last30.length} dias</span>
              <span className="text-muted-foreground">{Math.round(s.totalMinutes / 60)} h praticadas</span>
            </div>
            <SkillConditionChart days={last30} floor={s.minimumCondition} />
          </section>
        )}

        {trend.length > 2 && (
          <section>
            <div className="mb-2 text-[13px] font-medium">Semana a semana</div>
            <ol className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {trend.map((t) => {
                const Icon = t.direction === 'up' ? ArrowUpRight : t.direction === 'down' ? ArrowDownRight : ArrowRight
                return (
                  <li key={t.date} className="flex min-w-12 flex-1 flex-col items-center rounded-xl bg-surface px-1.5 py-2" title={formatDate(t.date, "d 'de' MMM")}>
                    <Icon className={cn('size-3.5', t.direction === 'up' && 'text-[var(--hc)]', t.direction === 'down' && 'text-[var(--rust-color)]', t.direction === 'flat' && 'text-muted-foreground')} />
                    <span className="mt-0.5 text-[13px] font-semibold tabular">{Math.round(t.condition)}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        <section className="text-[13px]">
          <div className="mb-1.5 flex items-center gap-1.5 font-medium">
            <Link2 className="size-3.5 text-muted-foreground" /> Treinada por
          </div>
          {links.length === 0 ? (
            <p className="text-muted-foreground">Nenhum hábito vinculado — registre práticas avulsas ou vincule um hábito em Editar.</p>
          ) : (
            <ul className="space-y-1">
              {links.map((l) => {
                const h = habits.find((x) => x.id === l.habitId)
                return h ? (
                  <li key={l.habitId} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <HabitGlyph icon={h.icon} color={h.color} size="sm" className="size-6 rounded-md [&_svg]:size-3.5" />
                      <span className="truncate">{h.name}</span>
                    </span>
                    <span className="text-muted-foreground tabular">+{WEIGHT_LABEL(l.weight)}</span>
                  </li>
                ) : null
              })}
            </ul>
          )}
        </section>

        {recent.length > 0 && (
          <section className="text-[13px]">
            <div className="mb-1.5 font-medium">Práticas recentes</div>
            <ul className="divide-y rounded-xl border">
              {recent.map((p) => {
                const h = p.sourceHabitId ? habits.find((x) => x.id === p.sourceHabitId) : null
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{practiceLabel(p)}</span>
                      <span className="text-muted-foreground"> · {relativeDayLabel(p.date, today)}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {h ? `via ${h.name}${p.weight < 1 ? ` (${WEIGHT_LABEL(p.weight)})` : ''}` : 'Prática avulsa'}
                      </span>
                    </span>
                    {!p.sourceLogId && (
                      <button
                        type="button"
                        aria-label="Remover prática"
                        onClick={() => removePractice(p.id, today)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {s.totalPractices} práticas · {formatNumber(Math.round(s.totalMinutes))} min no total
            </p>
          </section>
        )}
      </div>
    </ResponsiveModal>
  )
}
