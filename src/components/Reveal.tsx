'use client'
export function Reveal({
  open,
  children,
}: {
  open: boolean
  children: React.ReactNode
}) {
  return (
    <div className="reveal" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="reveal-inner">{children}</div>
    </div>
  )
}
