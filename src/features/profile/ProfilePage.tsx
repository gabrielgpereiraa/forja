import { useRef, useState } from 'react'
import {
  Award,
  Brain,
  ChevronDown,
  Download,
  Flame,
  Gift,
  HeartPulse,
  Lock,
  Palette,
  RotateCcw,
  Shield,
  Sparkles,
  Upload,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/chip-group'
import { PageHeader, Surface } from '@/components/layout'
import { ProgressBar } from '@/components/progress/progress-bar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { attributeLevel } from '@/domain/gamification/engine'
import { xpForLevel } from '@/domain/gamification/levels'
import { DEFAULT_RULES } from '@/domain/gamification/rules'
import { ATTRIBUTE_IDS, ATTRIBUTES, type AttributeId } from '@/domain/models/attributes'
import type { AchievementTier } from '@/domain/models/gamification'
import { CURRENT_SCORING } from '@/domain/scoring'
import { STREAK_MIN_SCORE } from '@/domain/rules/streaks'
import { usePlayer, useSkillViews, useStreak } from '@/hooks/use-domain'
import { HabitGlyph } from '@/components/appearance'
import { SkillStatusChip } from '@/features/skills/SkillCard'
import { Link } from 'react-router'
import { useToday } from '@/hooks/use-today'
import { cn, formatNumber } from '@/lib/utils'
import type { AppData, ThemePreference } from '@/services/app-data'
import { exportData, useAppStore } from '@/store/app-store'
import { AccountCard } from '@/features/auth/AccountCard'
import { cloudEnabled } from '@/lib/supabase'

const ATTRIBUTE_ICON: Record<AttributeId, LucideIcon> = {
  vitality: HeartPulse,
  intellect: Brain,
  creativity: Palette,
  spirit: Sparkles,
  discipline: Shield,
}

const TIER_STYLE: Record<AchievementTier, string> = {
  bronze: 'text-[oklch(0.72_0.1_55)] bg-[oklch(0.72_0.1_55/0.14)]',
  silver: 'text-[oklch(0.8_0.02_260)] bg-[oklch(0.8_0.02_260/0.14)]',
  gold: 'text-xp bg-xp/14',
}

export function ProfilePage() {
  const today = useToday()
  const player = usePlayer(today)
  const streak = useStreak(today)
  const profile = useAppStore((s) => s.profile)
  const settings = useAppStore((s) => s.settings)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const loadDemo = useAppStore((s) => s.loadDemo)
  const resetAll = useAppStore((s) => s.resetAll)
  const importData = useAppStore((s) => s.importData)
  const [name, setName] = useState(profile.name)
  const [confirm, setConfirm] = useState<'demo' | 'reset' | null>(null)
  const [showRules, setShowRules] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { level } = player
  const skillViews = useSkillViews(today)
    .filter((v) => !v.skill.archived)
    .sort((a, b) => b.snapshot.level - a.snapshot.level || b.snapshot.experience - a.snapshot.experience)
  const unlockedCount = player.achievements.filter((a) => a.unlocked).length
  const focus = player.balances.focus ?? 0

  const download = () => {
    const blob = new Blob([JSON.stringify({ app: 'forja', version: 1, exportedAt: new Date().toISOString(), data: exportData() }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forja-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { data?: AppData }
      if (!parsed.data || !Array.isArray(parsed.data.habits)) throw new Error('formato')
      importData(parsed.data)
      toast('Dados importados')
    } catch {
      toast.error('Arquivo inválido', { description: 'Use um backup exportado pelo próprio app.' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Perfil" subtitle="Seu personagem na vida real." profile={false} />

      {/* Personagem */}
      <Surface className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-xp/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="flex size-[68px] items-center justify-center rounded-[22px] border border-xp/30 bg-surface-2 font-display text-[28px] font-semibold">
              {(profile.name || '?').charAt(0).toUpperCase()}
            </div>
            <span className="absolute -right-1.5 -bottom-1.5 rounded-lg border-2 border-card bg-xp px-1.5 py-0.5 text-[11px] font-bold text-xp-foreground">
              {level.level}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-xl font-semibold">{profile.name || 'Sem nome'}</div>
            <div className="text-[13px] text-muted-foreground">
              Nível {level.level} · <span className="text-xp">{level.title}</span>
            </div>
          </div>
        </div>
        <div className="relative mt-5">
          <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
            <span className="tabular">
              {formatNumber(level.currentXp)} / {formatNumber(level.requiredXp)} XP
            </span>
            <span>Nível {level.level + 1} em {formatNumber(xpForLevel(level.level + 1) - level.totalXp)} XP</span>
          </div>
          <ProgressBar value={level.progress} size="md" barClassName="bg-xp" label="Progresso de nível" />
        </div>
        <div className="relative mt-5 grid grid-cols-4 gap-2 border-t pt-4 text-center">
          {[
            { icon: Zap, label: 'XP total', value: formatNumber(level.totalXp) },
            { icon: Sparkles, label: 'Foco', value: formatNumber(focus) },
            { icon: Flame, label: 'Sequência', value: streak.current },
            { icon: Award, label: 'Conquistas', value: `${unlockedCount}/${player.achievements.length}` },
          ].map((s) => (
            <div key={s.label}>
              <s.icon className="mx-auto size-4 text-xp" />
              <div className="mt-1 font-display text-[17px] font-semibold">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </Surface>

      {/* Atributos */}
      <section className="mt-6">
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Atributos</h2>
        <Surface className="divide-y">
          {ATTRIBUTE_IDS.map((id) => {
            const xp = player.attributes[id] ?? 0
            const lv = attributeLevel(xp)
            const Icon = ATTRIBUTE_ICON[id]
            return (
              <div key={id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{ATTRIBUTES[id].label}</span>
                    <span className="text-[12px] text-muted-foreground tabular">
                      Nv {lv.level} · {formatNumber(xp)} XP
                    </span>
                  </div>
                  <ProgressBar value={lv.progress} size="xs" className="mt-1.5" barClassName="bg-foreground/70" label={ATTRIBUTES[id].label} />
                  <div className="mt-1 text-[11px] text-muted-foreground/80">{ATTRIBUTES[id].description}</div>
                </div>
              </div>
            )
          })}
        </Surface>
      </section>

      {/* Habilidades (resumo) */}
      {skillViews.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Habilidades</h2>
            <Link to="/habilidades" className="text-[13px] font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <Surface className="divide-y">
            {skillViews.slice(0, 5).map(({ skill, snapshot }) => (
              <Link key={skill.id} to="/habilidades" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <HabitGlyph icon={skill.icon} color={skill.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{skill.name}</span>
                <SkillStatusChip status={snapshot.status} />
                <span className="w-14 text-right text-[12px] text-muted-foreground tabular">Nv {snapshot.level}</span>
              </Link>
            ))}
          </Surface>
        </section>
      )}

      {/* Conquistas */}
      <section className="mt-6">
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Conquistas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {player.achievements.map(({ def, progress, unlocked }) => (
            <div key={def.id} className={cn('rounded-2xl border bg-card p-3.5', !unlocked && 'bg-transparent')}>
              <div className="flex items-start justify-between">
                <span className={cn('flex size-8 items-center justify-center rounded-xl', unlocked ? TIER_STYLE[def.tier] : 'bg-muted text-muted-foreground/60')}>
                  {unlocked ? <Award className="size-4" /> : <Lock className="size-3.5" />}
                </span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">{def.tier === 'bronze' ? 'Bronze' : def.tier === 'silver' ? 'Prata' : 'Ouro'}</span>
              </div>
              <div className={cn('mt-2.5 text-[14px] font-semibold', !unlocked && 'text-muted-foreground')}>{def.title}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{def.description}</div>
              {!unlocked && (
                <div className="mt-2.5 flex items-center gap-2">
                  <ProgressBar value={progress.current / progress.target} size="xs" barClassName="bg-muted-foreground/60" />
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular">
                    {progress.current}/{progress.target}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Recompensas (preparação) */}
      <section className="mt-6">
        <Surface className="flex items-start gap-4 border-dashed p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-xp/12 text-xp">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              Recompensas <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Em breve</span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Você já acumulou <span className="font-semibold text-foreground">{formatNumber(focus)} pontos de foco</span>. Em breve será possível trocá-los
              por recompensas que você mesmo define — ex.: cada minuto de guitarra libera um minuto de música.
            </p>
          </div>
        </Surface>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-[13px] text-muted-foreground hover:text-foreground"
          aria-expanded={showRules}
        >
          Como ganho XP e foco?
          <ChevronDown className={cn('size-4 transition-transform', showRules && 'rotate-180')} />
        </button>
        {showRules && (
          <Surface className="divide-y text-[13px]">
            {DEFAULT_RULES.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-medium">{r.label}</span>
                <span className="text-right text-muted-foreground">{r.description}</span>
              </div>
            ))}
            <div className="px-4 py-2.5 text-muted-foreground">
              Dias com nota {STREAK_MIN_SCORE}+ mantêm a sequência. Dias sem nada planejado não contam nem quebram.
            </div>
          </Surface>
        )}
      </section>

      {/* Conta */}
      <section className="mt-6">
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Conta</h2>
        <AccountCard />
      </section>

      {/* Ajustes */}
      <section className="mt-6 space-y-2">
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Ajustes</h2>
        <Surface className="divide-y">
          <div className="space-y-2 p-4">
            <label htmlFor="profile-name" className="text-[13px] font-medium text-muted-foreground">
              Como quer ser chamado
            </label>
            <Input
              id="profile-name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== profile.name && updateProfile({ name: name.trim() })}
            />
          </div>
          <div className="space-y-2 p-4">
            <div className="text-[13px] font-medium text-muted-foreground">Tema</div>
            <ChipGroup<ThemePreference>
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'dark', label: 'Escuro' },
                { value: 'light', label: 'Claro' },
                { value: 'system', label: 'Sistema' },
              ]}
            />
          </div>
          <div className="space-y-2 p-4">
            <div className="text-[13px] font-medium text-muted-foreground">Seu dia termina às</div>
            <ChipGroup<number>
              value={settings.dayStartHour}
              onChange={(dayStartHour) => updateSettings({ dayStartHour })}
              options={[0, 2, 4, 6].map((h) => ({ value: h, label: h === 0 ? 'Meia-noite' : `${h}h` }))}
            />
            <p className="text-[12px] text-muted-foreground/80">Atividades de madrugada antes desse horário contam para o dia anterior.</p>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            <Button variant="secondary" size="sm" onClick={download}>
              <Download /> Exportar dados
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Importar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => setConfirm('demo')}>
              <Wand2 /> Dados de exemplo
            </Button>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirm('reset')}>
              <RotateCcw /> Apagar tudo
            </Button>
          </div>
        </Surface>
        <p className="px-1 pt-2 text-[12px] text-muted-foreground/70">
          {cloudEnabled ? 'Dados salvos na sua conta' : 'Dados salvos apenas neste dispositivo'} · {CURRENT_SCORING.label}
        </p>
      </section>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'demo' ? 'Carregar dados de exemplo?' : 'Apagar todos os dados?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'demo'
                ? 'Seus hábitos, tarefas e histórico atuais serão substituídos por ~5 semanas simuladas. Exporte antes se quiser guardar.'
                : `Hábitos, tarefas, histórico, XP e conquistas serão removidos ${cloudEnabled ? 'da sua conta, em todos os aparelhos' : 'deste dispositivo'}. Isso não pode ser desfeito.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === 'demo') loadDemo(today)
                else resetAll()
                setConfirm(null)
              }}
            >
              {confirm === 'demo' ? 'Substituir' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
