import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'

import { Toaster } from '@/components/ui/sonner'
import { useApplyTheme } from '@/hooks/use-theme'
import { useAppStore } from '@/store/app-store'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { TodayPage } from '@/features/today/TodayPage'
import { AppShell } from './AppShell'

// "Hoje" é a tela crítica e carrega junto; as demais são divididas em chunks.
const HabitsPage = lazy(() => import('@/features/habits/HabitsPage').then((m) => ({ default: m.HabitsPage })))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })))
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const SkillsPage = lazy(() => import('@/features/skills/SkillsPage').then((m) => ({ default: m.SkillsPage })))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))

export function App() {
  useApplyTheme()
  const onboarded = useAppStore((s) => s.profile.onboardedAt !== null)

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {onboarded ? (
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<TodayPage />} />
              <Route path="habitos" element={<HabitsPage />} />
              <Route path="tarefas" element={<TasksPage />} />
              <Route path="habilidades" element={<SkillsPage />} />
              <Route path="progresso" element={<ProgressPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        ) : (
          <OnboardingPage />
        )}
      </BrowserRouter>
      <Toaster />
    </MotionConfig>
  )
}
