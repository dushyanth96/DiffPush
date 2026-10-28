import { useEffect, useState } from 'react'

// True below the `sm` breakpoint. Used for editor word-wrap and other
// mobile-only ergonomics that Monaco cannot express with CSS alone.
export function useNarrow(maxWidth = 639) {
  const [narrow, setNarrow] = useState(() => {
    try { return window.matchMedia(`(max-width: ${maxWidth}px)`).matches } catch { return false }
  })
  useEffect(() => {
    try {
      const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
      const on = () => setNarrow(mq.matches)
      on()
      mq.addEventListener('change', on)
      return () => mq.removeEventListener('change', on)
    } catch { return undefined }
  }, [maxWidth])
  return narrow
}
