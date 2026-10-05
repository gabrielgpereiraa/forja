import { useSearchParams } from 'react-router'
import { CalendarDays, CalendarRange } from 'lucide-react'

import { PageHeader } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToday } from '@/hooks/use-today'
import { HistoryView } from './HistoryView'
import { WeekView } from './WeekView'

export function ProgressPage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const tab = params.get('v') === 'historico' ? 'history' : 'week'

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-5xl">
      <PageHeader title="Progresso" subtitle="Como você está evoluindo, semana a semana." />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'history' ? { v: 'historico' } : {}, { replace: true })}>
        <TabsList className="w-full">
          <TabsTrigger value="week">
            <CalendarRange /> Semana
          </TabsTrigger>
          <TabsTrigger value="history">
            <CalendarDays /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="week">
          <WeekView today={today} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryView today={today} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
