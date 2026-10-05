import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'

/** Número que anima entre valores (nota, XP, %). */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 0.6,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    const controls = animate(from, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setDisplay,
    })
    return () => controls.stop()
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
