import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsDesktop } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Bottom sheet no celular, diálogo centralizado no desktop. */
export function ResponsiveModal({ open, onOpenChange, title, description, children, footer, className }: ResponsiveModalProps) {
  const desktop = useIsDesktop()
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('gap-5', className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </DialogHeader>
          {children}
          {footer && <div className="flex flex-col gap-2">{footer}</div>}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className={className}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
        {footer && <div className="flex flex-col gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]" />}
      </DrawerContent>
    </Drawer>
  )
}
