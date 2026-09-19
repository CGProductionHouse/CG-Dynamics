import { type HTMLAttributes, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

function Drawer({ open, onOpenChange, children }: DrawerProps) {
  if (!open) return null

  return (
    <>
      <DrawerOverlay onClick={() => onOpenChange(false)} />
      <DrawerContent>{children}</DrawerContent>
    </>
  )
}

function DrawerOverlay({ className, onClick, children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div
      className={`fixed inset-0 z-40 ${className ?? ''}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

function DrawerContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`fixed z-50 inset-x-0 bottom-0 top-16 md:top-0 md:left-auto md:right-0 md:w-[480px] md:max-w-[90vw] md:h-full flex flex-col ${className ?? ''}`}
      {...props}
    >
      {children}
    </div>
  )
}

function DrawerHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col gap-1 border-b border-white/10 px-5 py-3 ${className ?? ''}`} {...props}>
      {children}
    </div>
  )
}

function DrawerTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-base font-black text-white ${className ?? ''}`} {...props}>{children}</h2>
}

function DrawerDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-white/60 ${className ?? ''}`} {...props}>{children}</p>
}

function DrawerBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex-1 overflow-y-auto px-5 py-4 ${className ?? ''}`} {...props}>{children}</div>
}

function DrawerFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3 ${className ?? ''}`} {...props}>{children}</div>
}

function DrawerCloseButton({ className, onClick, ...props }: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-xs font-bold text-white/45 hover:text-white transition-colors ${className ?? ''}`}
      onClick={onClick}
      {...props}
    >
      Close
    </button>
  )
}

export { Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerCloseButton }
export type { DrawerProps }