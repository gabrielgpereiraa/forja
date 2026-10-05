import { useEffect, useState } from 'react'

import { useAppStore } from '@/store/app-store'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useResolvedTheme(): 'dark' | 'light' {
  const pref = useAppStore((s) => s.settings.theme)
  const [system, setSystem] = useState(systemPrefersDark)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  if (pref === 'system') return system ? 'dark' : 'light'
  return pref
}

/** Aplica a classe `.dark` no <html>. */
export function useApplyTheme(): void {
  const theme = useResolvedTheme()
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0e12' : '#f9f9fb')
  }, [theme])
}
