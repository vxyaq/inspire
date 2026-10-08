import React, { useEffect } from "react"
import ReactDOM from "react-dom"

interface ModalProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export default function Modal({ open, onClose, onOpenChange, children }: ModalProps) {
  const handleClose = () => {
    onClose?.()
    onOpenChange?.(false)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    if (open) window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose, onOpenChange])

  return ReactDOM.createPortal(
    <div
      onClick={handleClose}
      className={`
        fixed inset-0 flex justify-center items-center z-[9999] transition-all
        ${open ? "visible bg-black/60" : "invisible bg-black/0"}
      `}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          transform transition-all duration-200 ease-in-out
          ${open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}
        `}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
