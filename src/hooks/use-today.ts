import { useEffect, useState } from 'react'

import { getProductivityDate, type ISODate } from '@/domain/date'
import { useAppStore } from '@/store/app-store'

/** Data do "dia de produtividade" atual, reavaliada a cada minuto e ao voltar para a aba. */
export function useToday(): ISODate {
  const dayStartHour = useAppStore((s) => s.settings.dayStartHour)
  const [today, setToday] = useState(() => getProductivityDate(new Date(), dayStartHour))

  useEffect(() => {
    const update = () => setToday(getProductivityDate(new Date(), dayStartHour))
    update()
    const id = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', update)
    }
  }, [dayStartHour])

  return today
}
