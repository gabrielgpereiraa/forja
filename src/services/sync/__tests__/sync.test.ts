import { describe, expect, it } from 'vitest'

import { createEmptyData, migrateData, SCHEMA_VERSION, type AppData } from '@/services/app-data'
import * as cmd from '@/services/commands'
import { buildDemoData } from '@/services/demo-seed'
import { allChanges, applyRows, diffData, TABLES, type RemoteRow, type TableName } from '../collections'
import { SyncEngine, type KeyValueStore, type RemoteStore } from '../engine'

const TODAY = '2026-10-05' as const
const HABIT = { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 3, days: null }, target: null } as const

/* ------------------------------ dublês ------------------------------ */

/** Servidor em memória: updated_at definido "pelo servidor" com relógio crescente. */
function fakeServer() {
  const tables = new Map<TableName, Map<string, RemoteRow>>(TABLES.map((t) => [t, new Map()]))
  let clock = Date.parse('2026-10-05T12:00:00Z')
  let down = false
  const remote: RemoteStore = {
    async pull(table, since) {
      if (down) throw new Error('offline')
      return [...tables.get(table)!.values()].filter((r) => !since || r.updated_at >= since).sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    },
    async push(table, changes) {
      if (down) throw new Error('offline')
      for (const c of changes) {
        clock += 1000
        tables.get(table)!.set(c.id, { id: c.id, data: c.data ?? {}, updated_at: new Date(clock).toISOString(), deleted_at: c.data === null ? new Date(clock).toISOString() : null })
      }
    },
  }
  return { remote, tables, setDown: (v: boolean) => (down = v) }
}

function memoryKv(): KeyValueStore {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

/** Um "aparelho": estado local + motor ligado ao servidor. */
function device(remote: RemoteStore, kv: KeyValueStore = memoryKv(), initial: AppData = createEmptyData()) {
  let state = initial
  const listeners = new Set<(n: AppData, p: AppData) => void>()
  const set = (next: AppData) => {
    const prev = state
    state = next
    for (const l of listeners) l(next, prev)
  }
  const engine = new SyncEngine({
    userId: 'u1',
    remote,
    kv,
    getData: () => state,
    setData: set,
    subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
    pushDelayMs: 60_000, // nos testes, envio só via flush()
  })
  return { engine, kv, get: () => state, set }
}

/* ------------------------------ testes ------------------------------ */

describe('collections', () => {
  it('diff por referência pega só o que mudou (hábito, registro, XP, conquista)', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-01')
    const { data, habit } = cmd.createHabit(base, HABIT, '2026-10-01')
    const done = cmd.toggleHabit(data, habit.id, TODAY).data
    const tables = new Set(diffData(data, done).map((c) => c.table))
    expect(tables).toEqual(new Set(['habit_logs', 'ledger_entries', 'achievements']))
    expect(diffData(done, done)).toEqual([])
  })

  it('exclusão vira mudança com data null', () => {
    const { data, habit } = cmd.createHabit(createEmptyData(), HABIT, TODAY)
    const removed = cmd.deleteHabit(data, habit.id, TODAY)
    expect(diffData(data, removed)).toContainEqual({ table: 'habits', id: habit.id, data: null })
  })

  it('ida e volta: todas as entidades → linhas → estado idêntico', () => {
    const demo = buildDemoData(TODAY, 'Nino')
    const byTable = new Map<TableName, RemoteRow[]>()
    for (const c of allChanges(demo)) {
      const rows = byTable.get(c.table) ?? []
      rows.push({ id: c.id, data: c.data, updated_at: '2026-10-05T00:00:00Z', deleted_at: null })
      byTable.set(c.table, rows)
    }
    let rebuilt = createEmptyData()
    for (const [table, rows] of byTable) rebuilt = applyRows(rebuilt, table, rows)
    expect(JSON.parse(JSON.stringify(rebuilt))).toEqual(JSON.parse(JSON.stringify(demo)))
  })

  it('aplicar linhas iguais não cria novo estado', () => {
    const { data, habit } = cmd.createHabit(createEmptyData(), HABIT, TODAY)
    const same = applyRows(data, 'habits', [{ id: habit.id, data: JSON.parse(JSON.stringify(habit)), updated_at: 'x', deleted_at: null }])
    expect(same).toBe(data)
  })
})

describe('SyncEngine', () => {
  it('conta nova: primeira carga informa servidor vazio', async () => {
    const { remote } = fakeServer()
    const a = device(remote)
    expect(await a.engine.start()).toEqual({ remoteEmpty: true, pulled: true })
  })

  it('o que um aparelho faz aparece no outro, inclusive exclusões', async () => {
    const server = fakeServer()
    const a = device(server.remote)
    const b = device(server.remote)
    await a.engine.start()
    await b.engine.start()

    const { data, habit } = cmd.createHabit(cmd.completeOnboarding(a.get(), 'Nino', TODAY), HABIT, TODAY)
    a.set(cmd.toggleHabit(data, habit.id, TODAY).data)
    expect(await a.engine.flush()).toBe(0)

    await b.engine.sync()
    expect(b.get().profile.name).toBe('Nino')
    expect(b.get().habits.map((h) => h.id)).toEqual([habit.id])
    expect(b.get().logs).toHaveLength(1)

    b.set(cmd.deleteHabit(b.get(), habit.id, TODAY))
    await b.engine.flush()
    await a.engine.sync()
    expect(a.get().habits).toHaveLength(0)
    expect(a.get().logs).toHaveLength(0)
  })

  it('aplicar dados do servidor não gera reenvio', async () => {
    const server = fakeServer()
    const a = device(server.remote)
    const b = device(server.remote)
    await a.engine.start()
    await b.engine.start()
    a.set(cmd.createHabit(a.get(), HABIT, TODAY).data)
    await a.engine.flush()
    await b.engine.sync()
    expect(b.engine.state.pending).toBe(0)
  })

  it('offline: alterações ficam na fila persistida e sobem quando volta', async () => {
    const server = fakeServer()
    const kv = memoryKv()
    const a = device(server.remote, kv)
    await a.engine.start()
    server.setDown(true)
    const { data, habit } = cmd.createHabit(a.get(), HABIT, TODAY)
    a.set(data)
    expect(await a.engine.flush()).toBe(1)
    a.engine.stop()

    // App reaberto (mesmo armazenamento local, estado reidratado do cache).
    server.setDown(false)
    const again = device(server.remote, kv, a.get())
    expect(again.engine.state.pending).toBe(1)
    await again.engine.start()
    expect(again.engine.state.pending).toBe(0)
    expect(server.tables.get('habits')!.has(habit.id)).toBe(true)
  })

  it('alteração local pendente vence a versão do servidor até ser enviada', async () => {
    const server = fakeServer()
    const a = device(server.remote)
    const b = device(server.remote)
    await a.engine.start()
    await b.engine.start()
    const created = cmd.createHabit(a.get(), HABIT, TODAY)
    a.set(created.data)
    await a.engine.flush()
    await b.engine.sync()

    // B renomeia (pendente), A renomeia e envia; B baixa antes de enviar.
    const id = created.habit.id
    const rename = (d: AppData, name: string) => cmd.updateHabit(d, id, { ...HABIT, name }, TODAY)
    b.set(rename(b.get(), 'Ler (B)'))
    a.set(rename(a.get(), 'Ler (A)'))
    await a.engine.flush()
    await b.engine.sync() // sync = envia B e depois baixa → B é a última escrita
    expect(b.get().habits[0]?.name).toBe('Ler (B)')
    await a.engine.sync()
    expect(a.get().habits[0]?.name).toBe('Ler (B)')
  })
})

/* ------------------------- persistência do retrato ------------------------- */

describe('scoringSnapshot e confirmações tardias persistem', () => {
  const D = '2026-10-06' as const
  const NEXT = '2026-10-07' as const
  /** Dia encerrado à noite com um hábito confirmado na manhã seguinte (retrato + confirmação). */
  function closedAndConfirmed(): { data: AppData; sleepId: string } {
    let data = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
    const sleep = cmd.createHabit(data, { ...HABIT, name: 'Dormir', schedule: { weeklyGoal: 7, days: null }, confirmNextDay: true }, '2026-10-05')
    const read = cmd.createHabit(sleep.data, { ...HABIT, schedule: { weeklyGoal: 7, days: null } }, '2026-10-05')
    const task = cmd.createTask(read.data, { title: 'Relatório', dueDate: D, priority: 'high' }, '2026-10-05')
    data = cmd.toggleHabit(task.data, read.habit.id, D).data
    data = cmd.closeDay(data, D, 'user', D).data
    data = cmd.confirmLateHabit(data, sleep.habit.id, D, NEXT, true).data
    expect(data.records[D]?.scoringSnapshot?.habits).toHaveLength(2)
    expect(data.records[D]?.lateConfirmations).toHaveLength(1)
    return { data, sleepId: sleep.habit.id }
  }

  it('linhas → JSON (como o jsonb) → estado: o registro volta idêntico e continua funcional', () => {
    const { data, sleepId } = closedAndConfirmed()
    const rows: RemoteRow[] = allChanges(data)
      .filter((c) => c.table === 'day_records')
      .map((c) => ({ id: c.id, data: JSON.parse(JSON.stringify(c.data)), updated_at: 'x', deleted_at: null }))
    const rebuilt = applyRows({ ...data, records: {} }, 'day_records', rows)
    expect(rebuilt.records[D]).toEqual(data.records[D])
    // Desfazer no estado reconstruído dá o mesmo resultado que no original.
    const undo = (d: AppData) => cmd.confirmLateHabit(d, sleepId, D, NEXT, false).data.records[D]
    expect(undo(rebuilt)).toEqual(undo(data))
  })

  it('aparelho A → servidor → aparelho B: retrato e confirmações chegam inteiros', async () => {
    const server = fakeServer()
    const a = device(server.remote)
    const b = device(server.remote)
    await a.engine.start()
    await b.engine.start()
    const { data } = closedAndConfirmed()
    a.set(data)
    expect(await a.engine.flush()).toBe(0)
    await b.engine.sync()
    expect(JSON.parse(JSON.stringify(b.get().records[D]))).toEqual(JSON.parse(JSON.stringify(data.records[D])))
  })

  it('backup: exportar (JSON) → importar preserva o registro inteiro', () => {
    const { data } = closedAndConfirmed()
    // Mesmo formato do botão "Exportar dados" e do "Importar" do perfil.
    const file = JSON.stringify({ app: 'forja', version: 1, exportedAt: 'x', data }, null, 2)
    const imported = migrateData((JSON.parse(file) as { data: AppData }).data, SCHEMA_VERSION)
    expect(imported.records[D]).toEqual(data.records[D])
    expect(imported.records[D]?.scoringSnapshot).toEqual(data.records[D]?.scoringSnapshot)
  })
})
