import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Anvil, ChartColumn, House, ListTodo, Plus, Repeat, User, type LucideIcon } from 'lucide-react'

import { Brand } from '@/components/brand'
import { ProgressBar } from '@/components/progress/progress-bar'
import { ResponsiveModal } from '@/components/responsive-modal'
import { usePlayer } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { HabitFormModal } from '@/features/habits/HabitFormModal'
import { HabitLogModal } from '@/features/habits/HabitLogModal'
import { DayDetailModal } from '@/features/progress/DayDetailModal'
import { TaskFormModal } from '@/features/tasks/TaskFormModal'
import { PracticeSheet } from '@/features/skills/PracticeSheet'
import { SkillDetailModal } from '@/features/skills/SkillDetailModal'
import { SkillFormModal } from '@/features/skills/SkillFormModal'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/', label: 'Hoje', icon: House },
  { to: '/habitos', label: 'Hábitos', icon: Repeat },
  { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { to: '/habilidades', label: 'Habilidades', icon: Anvil },
  { to: '/progresso', label: 'Progresso', icon: ChartColumn },
]

/** Na sidebar o Perfil também aparece como item (no celular, pelo avatar). */
const SIDEBAR_NAV: NavItem[] = [...NAV, { to: '/perfil', label: 'Perfil', icon: User }]

function SidebarPlayer() {
  const today = useToday()
  const { level } = usePlayer(today)
  const name = useAppStore((s) => s.profile.name)
  return (
    <NavLink to="/perfil" className="block rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-surface-2 font-display font-semibold">{(name || '?').charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="text-[12px] text-muted-foreground">
            Nível {level.level} · <span className="text-xp">{level.title}</span>
          </div>
        </div>
      </div>
      <ProgressBar value={level.progress} size="xs" className="mt-3" barClassName="bg-xp" label="XP do nível" />
    </NavLink>
  )
}

function QuickAddSheet() {
  const open = useUiStore((s) => s.quickAdd)
  const setOpen = useUiStore((s) => s.setQuickAdd)
  const { openHabitForm, openTaskForm, openSkillForm } = useUiStore()
  return (
    <ResponsiveModal open={open} onOpenChange={setOpen} title="Adicionar">
      <div className="grid grid-cols-2 gap-2 pb-2">
        <button type="button" onClick={() => openTaskForm()} className="rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-surface-2">
          <ListTodo className="size-5 text-primary" />
          <div className="mt-3 font-semibold">Tarefa</div>
          <div className="text-[12px] text-muted-foreground">Ação pontual, com data</div>
        </button>
        <button type="button" onClick={() => openHabitForm()} className="rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-surface-2">
          <Repeat className="size-5 text-primary" />
          <div className="mt-3 font-semibold">Hábito</div>
          <div className="text-[12px] text-muted-foreground">Compromisso semanal recorrente</div>
        </button>
        <button type="button" onClick={() => { setOpen(false); openSkillForm() }} className="col-span-2 flex items-center gap-3 rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-surface-2">
          <Anvil className="size-5 shrink-0 text-primary" />
          <div>
            <div className="font-semibold">Habilidade</div>
            <div className="text-[12px] text-muted-foreground">Algo que evolui com a prática dos hábitos</div>
          </div>
        </button>
      </div>
    </ResponsiveModal>
  )
}

export function AppShell() {
  const today = useToday()
  const autoClose = useAppStore((s) => s.autoCloseMissedDays)
  const location = useLocation()
  const isToday = location.pathname === '/'
  const setQuickAdd = useUiStore((s) => s.setQuickAdd)

  // Encerra automaticamente dias anteriores que ficaram abertos.
  useEffect(() => {
    autoClose(today)
  }, [today, autoClose])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="app-backdrop min-h-dvh">
      {/* Sidebar (tablet/desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background/80 px-4 py-5 backdrop-blur-xl md:flex">
        <Brand className="px-2" />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
          {SIDEBAR_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-[18px]', isActive && 'text-primary')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setQuickAdd(true)}
          className="mt-4 flex h-10 items-center gap-3 rounded-xl border border-dashed px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
        >
          <Plus className="size-[18px]" /> Adicionar
        </button>
        <div className="mt-auto">
          <SidebarPlayer />
        </div>
      </aside>

      <main
        className={cn(
          'px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:pl-[calc(16rem+2rem)] md:pr-8 md:pt-8',
          isToday ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom))] lg:pb-10' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10',
        )}
      >
        <Suspense fallback={<div className="h-dvh" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* FAB fora da tela Hoje (lá a barra de ação já tem o "+") */}
      {!isToday && (
        <button
          type="button"
          onClick={() => setQuickAdd(true)}
          aria-label="Adicionar"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-black/30 transition-transform active:scale-95 md:hidden"
        >
          <Plus className="size-6" />
        </button>
      )}

      {/* Navegação inferior (mobile) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary/15')}>
                    <item.icon className={cn('size-5', isActive && 'text-primary')} strokeWidth={isActive ? 2.25 : 2} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <QuickAddSheet />
      <HabitFormModal />
      <HabitLogModal />
      <TaskFormModal />
      <DayDetailModal />
      <SkillFormModal />
      <SkillDetailModal />
      <PracticeSheet />
    </div>
  )
}
