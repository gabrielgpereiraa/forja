import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useResolvedTheme } from '@/hooks/use-theme'

function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme()
  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={16}
      mobileOffset={12}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-2xl !border !border-border !bg-popover !text-popover-foreground !shadow-xl !shadow-black/20 !px-4 !py-3 !gap-3',
          title: '!text-[14px] !font-medium',
          description: '!text-[13px] !text-muted-foreground',
          actionButton: '!rounded-lg !bg-secondary !text-secondary-foreground !font-medium',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
