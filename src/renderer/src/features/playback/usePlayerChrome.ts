import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { IdleControls } from './IdleControls'

export function usePlayerChrome(pinned: boolean): boolean {
  const [visible, setVisible] = useState(true)
  const controller = useRef<IdleControls | null>(null)
  const [keyboardFocus, setKeyboardFocus] = useState(false)

  useEffect(() => {
    const idle = new IdleControls(setVisible)
    controller.current = idle
    let keyboard = false
    const pointer = (): void => {
      keyboard = false
      setKeyboardFocus(false)
      idle.reveal()
    }
    const move = (): void => idle.reveal()
    const key = (): void => {
      keyboard = true
      // Remove inert before the browser performs the default Tab action.
      flushSync(() => idle.reveal())
      setKeyboardFocus(
        document.activeElement instanceof HTMLElement &&
          document.activeElement.matches('button, input, select, textarea, a, [tabindex]'),
      )
    }
    const focus = (): void => {
      setKeyboardFocus(keyboard && document.activeElement !== document.body)
      idle.reveal()
    }
    const blur = (): void => setKeyboardFocus(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', pointer)
    window.addEventListener('keydown', key, true)
    window.addEventListener('focusin', focus)
    window.addEventListener('focusout', focus)
    window.addEventListener('blur', blur)
    idle.reveal()
    return () => {
      idle.dispose()
      controller.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', pointer)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('focusin', focus)
      window.removeEventListener('focusout', focus)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => controller.current?.pin(pinned || keyboardFocus), [pinned, keyboardFocus])
  return visible
}
