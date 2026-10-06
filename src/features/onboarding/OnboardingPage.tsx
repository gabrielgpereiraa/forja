import { useState } from 'react'
import { ListTodo, Repeat, TrendingUp } from 'lucide-react'

import { APP_NAME, BrandLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToday } from '@/hooks/use-today'
import { useAppStore } from '@/store/app-store'
import { useSession } from '@/features/auth/session'

const PILLARS = [
  { icon: Repeat, title: 'Hábitos', text: 'Compromissos recorrentes, medidos pela frequência da semana — não precisa ser todo dia.' },
  { icon: ListTodo, title: 'Tarefas', text: 'Ações pontuais. Marque como feita em um toque.' },
  { icon: TrendingUp, title: 'Evolução', text: 'Cada dia recebe uma nota explicável. Seu personagem ganha XP, níveis e atributos.' },
]

/** Primeiro acesso: nome + escolher começar do zero ou explorar com exemplos. */
export function OnboardingPage() {
  const today = useToday()
  const complete = useAppStore((s) => s.completeOnboarding)
  const googleName = useSession((s) => s.user?.name?.split(' ')[0] ?? '')
  const [name, setName] = useState(googleName)
  const valid = name.trim().length > 0

  return (
    <div className="app-backdrop flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md animate-rise">
        <BrandLogo className="-ml-3 w-36" />
        <h1 className="mt-5 font-display text-[34px] leading-[1.05] font-semibold">
          Forje seu personagem
          <br />
          <span className="text-muted-foreground">na vida real.</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {APP_NAME} é seu painel de evolução pessoal: o que fazer hoje, quanto já fez e se você está evoluindo.
        </p>

        <ul className="mt-7 space-y-3">
          {PILLARS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
                <p.icon className="size-[18px]" />
              </span>
              <div>
                <div className="text-sm font-semibold">{p.title}</div>
                <div className="text-[13px] text-muted-foreground">{p.text}</div>
              </div>
            </li>
          ))}
        </ul>

        <form
          className="mt-8 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) complete(name, today, false)
          }}
        >
          <label htmlFor="onb-name" className="text-[13px] font-medium text-muted-foreground">
            Como quer ser chamado?
          </label>
          <Input id="onb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome ou apelido" maxLength={30} autoComplete="given-name" />
          <Button type="submit" size="lg" className="w-full" disabled={!valid}>
            Começar
          </Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => complete(name.trim() || 'Nino', today, true)}>
            Explorar com dados de exemplo
          </Button>
        </form>
      </div>
    </div>
  )
}
