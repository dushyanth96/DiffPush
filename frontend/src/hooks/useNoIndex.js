import { useEffect } from 'react'

// Keeps utility routes out of search results. SPA navigations are client-side,
// so the tag is updated on mount and restored on unmount. Reuses any existing
// robots meta (RouteSeo / index.html) instead of appending duplicates.
export function useNoIndex() {
  useEffect(() => {
    let el = document.head.querySelector('meta[name="robots"]')
    const created = !el
    const previous = el?.getAttribute('content')
    if (!el) {
      el = document.createElement('meta')
      el.name = 'robots'
      document.head.appendChild(el)
    }
    el.content = 'noindex, nofollow'
    return () => {
      if (created) el.remove()
      else if (previous != null) el.content = previous
    }
  }, [])
}
