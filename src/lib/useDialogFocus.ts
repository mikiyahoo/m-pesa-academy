import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'

/**
 * Keyboard behaviour for a pop-up: focus moves into it, Tab stays inside, Esc closes it,
 * and focus returns to whatever opened it.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  // Callers usually pass an inline function; keep the latest without re-running the effect.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const nodes = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null)
    ;(nodes()[0] ?? ref.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current()
      if (e.key !== 'Tab') return
      const list = nodes()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [ref])
}
