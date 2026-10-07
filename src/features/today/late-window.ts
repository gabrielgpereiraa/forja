/** Texto do prazo da confirmação tardia (a janela fecha no início do dia, ex.: 04:00). */
export function lateDeadlineLabel(dayStartHour: number, now: Date = new Date()): string {
  if (dayStartHour === 0) return 'até a meia-noite'
  const hh = `${String(dayStartHour).padStart(2, '0')}:00`
  return now.getHours() < dayStartHour ? `até hoje às ${hh}` : `até ${hh} de amanhã`
}
