import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Check, CloudOff, HardDrive, Loader2, LogOut, RefreshCw } from 'lucide-react'

import { Surface } from '@/components/layout'
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
import type { SyncState } from '@/services/sync/engine'
import { signOut, syncNow, useSession } from './session'

/** Conta e estado da sincronização (Perfil). */
export function AccountCard() {
  const phase = useSession((s) => s.phase)
  const user = useSession((s) => s.user)
  const sync = useSession((s) => s.sync)
  const [busy, setBusy] = useState(false)
  const [unsynced, setUnsynced] = useState(0)

  if (phase === 'local') {
    return (
      <Surface className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
          <HardDrive className="size-5" />
        </span>
        <div className="text-[13px]">
          <div className="font-medium">Modo local</div>
          <div className="text-muted-foreground">Dados salvos apenas neste navegador.</div>
        </div>
      </Surface>
    )
  }
  if (!user) return null

  const leave = async (force = false) => {
    setBusy(true)
    const pending = await signOut({ force })
    setBusy(false)
    setUnsynced(pending)
  }

  return (
    <>
      <Surface className="p-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full border object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold">
              {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name ?? 'Conta Google'}</div>
            <div className="truncate text-[12px] text-muted-foreground">{user.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={() => void leave()}>
            {busy ? <Loader2 className="animate-spin" /> : <LogOut />} Sair
          </Button>
        </div>
        <button
          type="button"
          onClick={syncNow}
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-surface-2"
        >
          <SyncLine sync={sync} />
        </button>
      </Surface>

      <AlertDialog open={unsynced > 0} onOpenChange={(o) => !o && setUnsynced(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Há alterações não salvas na nuvem</AlertDialogTitle>
            <AlertDialogDescription>
              {unsynced} alteraç{unsynced > 1 ? 'ões' : 'ão'} ainda não chegaram ao servidor (sem conexão?). Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar conectado</AlertDialogCancel>
            <AlertDialogAction onClick={() => void leave(true)}>Sair mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SyncLine({ sync }: { sync: SyncState | null }) {
  if (!sync || sync.status === 'syncing') {
    return (
      <>
        <Loader2 className="size-3.5 animate-spin" /> Sincronizando…
      </>
    )
  }
  if (sync.status === 'offline') {
    return (
      <>
        <CloudOff className="size-3.5" /> Sem conexão
        {sync.pending > 0 && ` · ${sync.pending} alteraç${sync.pending > 1 ? 'ões' : 'ão'} na fila`}
      </>
    )
  }
  if (sync.status === 'error') {
    return (
      <>
        <AlertTriangle className="size-3.5 text-danger" /> Falha ao sincronizar — tentando de novo
        <RefreshCw className="ml-auto size-3.5" />
      </>
    )
  }
  return (
    <>
      <Check className="size-3.5 text-primary" />
      {sync.pending > 0 ? `${sync.pending} alteraç${sync.pending > 1 ? 'ões' : 'ão'} na fila` : 'Tudo salvo na nuvem'}
      {sync.lastSyncedAt && ` · ${formatDistanceToNowStrict(sync.lastSyncedAt, { locale: ptBR, addSuffix: true })}`}
      <RefreshCw className="ml-auto size-3.5" />
    </>
  )
}
