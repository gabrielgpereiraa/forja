import { useEffect, type ReactNode } from 'react'
import { CloudOff, Loader2, RotateCw } from 'lucide-react'

import { BrandLogo, BrandMark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { isLegalPath, LegalPage } from '@/features/legal/LegalPage'
import { ImportPrompt } from './ImportPrompt'
import { LoginPage } from './LoginPage'
import { retryInitialSync, signOut, startSession, useSession } from './session'

/**
 * Porta de entrada: sem Supabase configurado, renderiza o app direto (modo
 * local). Com Supabase, exige login e espera a primeira sincronização.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const phase = useSession((s) => s.phase)

  const legal = isLegalPath(window.location.pathname)

  useEffect(() => {
    if (!legal) startSession()
  }, [legal])

  if (legal) return <LegalPage page={window.location.pathname.startsWith('/termos') ? 'termos' : 'privacidade'} />
  if (phase === 'local') return children
  if (phase === 'signedOut') return <LoginPage />
  if (phase === 'loading') return <Splash />
  if (phase === 'unreachable') return <Unreachable />
  return (
    <>
      {children}
      <ImportPrompt />
    </>
  )
}

function Splash() {
  return (
    <div className="app-backdrop flex min-h-dvh flex-col items-center justify-center gap-5">
      <BrandMark className="size-14 animate-pulse" />
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando seus dados…
      </div>
    </div>
  )
}

function Unreachable() {
  return (
    <div className="app-backdrop flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm text-center animate-rise">
        <BrandLogo className="mx-auto w-32" />
        <CloudOff className="mx-auto mt-8 size-8 text-muted-foreground" />
        <h1 className="mt-3 font-display text-xl font-semibold">Não deu para buscar seus dados</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          É o primeiro acesso neste aparelho e o servidor não respondeu. Confira a conexão e tente de novo — nada foi perdido.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={() => void retryInitialSync()}>
            <RotateCw /> Tentar de novo
          </Button>
          <Button variant="ghost" onClick={() => void signOut({ force: true })}>
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  )
}
