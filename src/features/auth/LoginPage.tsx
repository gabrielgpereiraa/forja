import { useState } from 'react'
import { Cloud, Loader2, ShieldCheck, Smartphone } from 'lucide-react'

import { APP_NAME, BrandLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { signInWithGoogle, useSession } from './session'

const POINTS = [
  { icon: Cloud, text: 'Seu progresso fica salvo na nuvem.' },
  { icon: Smartphone, text: 'Use no celular e no computador — tudo sincronizado, até offline.' },
  { icon: ShieldCheck, text: 'Só você vê seus dados. Usamos apenas nome, e-mail e foto do Google.' },
]

/** Entrada com Google. */
export function LoginPage() {
  const error = useSession((s) => s.authError)
  const [busy, setBusy] = useState(false)

  return (
    <div className="app-backdrop flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-rise">
        <BrandLogo className="-ml-3 w-36" />
        <h1 className="mt-5 font-display text-[34px] leading-[1.05] font-semibold">
          Forje seu personagem
          <br />
          <span className="text-muted-foreground">na vida real.</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          Entre para começar — o {APP_NAME} guarda seus hábitos, tarefas e habilidades na sua conta.
        </p>

        <ul className="mt-7 space-y-3">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <p.icon className="size-4" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          variant="secondary"
          className="mt-8 h-12 w-full gap-3 rounded-2xl border bg-white text-[15px] text-neutral-900 hover:bg-neutral-100"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signInWithGoogle()
            setBusy(false)
          }}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
          Entrar com Google
        </Button>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-[13px] text-danger">
            Não foi possível entrar: {error}
          </p>
        )}

        <p className="mt-4 text-center text-[12px] text-muted-foreground/80">
          Ao entrar, você concorda com os{' '}
          <a href="/termos" className="underline hover:text-foreground">
            Termos
          </a>{' '}
          e a{' '}
          <a href="/privacidade" className="underline hover:text-foreground">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
