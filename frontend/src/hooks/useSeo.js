import { useEffect } from 'react'

export const SITE_URL = 'https://diffpush.pages.dev'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

function setMeta(attribute, key, value) {
  if (!value) return
  let el = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attribute, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!href) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

/**
 * Sets per-route title, description, canonical, robots, social cards, and an
 * optional JSON-LD block. RouteSeo supplies safe defaults; feature components
 * (e.g. Workspace) can mount it later with richer data and win the update.
 */
export function useSeo({
  title,
  description,
  canonical,
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd = null,
}) {
  const json = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    if (title) document.title = title
    setMeta('name', 'description', description)
    setMeta('name', 'robots', robots)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:image', image)
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', image)
    setCanonical(canonical)

    let script = null
    if (json) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-route-seo', '1')
      script.textContent = json
      document.head.appendChild(script)
    }

    return () => {
      script?.remove()
    }
  }, [title, description, canonical, robots, image, type, json])
}
