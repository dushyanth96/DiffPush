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

// True at or above the desktop breakpoint. Advertising mounts only on the
// side that can actually show it, so a hidden slot never requests a creative.
export function useMediaMin(minWidth = 1024) {
  const [wide, setWide] = useState(() => {
    try { return window.matchMedia(`(min-width: ${minWidth}px)`).matches } catch { return true }
  })
  useEffect(() => {
    try {
      const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
      const on = () => setWide(mq.matches)
      on()
      mq.addEventListener('change', on)
      return () => mq.removeEventListener('change', on)
    } catch { return undefined }
  }, [minWidth])
  return wide
}
