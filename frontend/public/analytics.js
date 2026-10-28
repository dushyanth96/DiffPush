(function () {
  var WEBSITE_ID = '1d227ef2-4b98-418a-a1c0-e979bb08ad4e'
  var SCRIPT_SRC = 'https://cloud.umami.is/script.js'
  var PRODUCTION_HOST = 'diffpush.pages.dev'
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
  var BLOCKED_PATHS = ['/auth/callback', '/ads-verify']
  var BLOCKED_KEYS = /token|code|secret|password|authorization|username|login|email/i

  function isBlockedPath(pathname) {
    return BLOCKED_PATHS.some(function (path) {
      return pathname === path || pathname.indexOf(path + '/') === 0
    })
  }

  function cleanValue(value) {
    if (typeof value === 'string') return value.slice(0, 120)
    if (typeof value === 'number' || typeof value === 'boolean') return value
    return undefined
  }

  function redactPath(pathname) {
    if (pathname === '/u' || pathname.indexOf('/u/') === 0) return '/u/redacted'
    return pathname
  }

  function sanitizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return raw
    var url
    try {
      url = new URL(raw, window.location.origin)
    } catch (error) {
      return raw
    }
    if (isBlockedPath(url.pathname)) return null
    url.pathname = redactPath(url.pathname)
    var allowed = new URLSearchParams()
    UTM_KEYS.forEach(function (key) {
      var value = url.searchParams.get(key)
      if (value) allowed.set(key, value.slice(0, 120))
    })
    url.search = allowed.toString()
    url.hash = ''
    return url.toString()
  }

  function sanitizeReferrer(raw) {
    if (!raw || typeof raw !== 'string') return raw
    try {
      var url = new URL(raw, window.location.origin)
      url.pathname = redactPath(url.pathname)
      url.search = ''
      url.hash = ''
      return url.toString()
    } catch (error) {
      return raw
    }
  }

  function beforeSend(type, payload) {
    try {
      if (!payload || typeof payload !== 'object') return payload
      var currentPath = ''
      try {
        currentPath = new URL(payload.url || window.location.href, window.location.origin).pathname
      } catch (error) {
        currentPath = window.location.pathname
      }
      if (isBlockedPath(currentPath)) return false
      if (payload.url) {
        var safeUrl = sanitizeUrl(payload.url)
        if (!safeUrl) return false
        payload.url = safeUrl
      }
      if (redactPath(currentPath) !== currentPath) payload.title = 'DiffPush certificate'
      if (payload.referrer) payload.referrer = sanitizeReferrer(payload.referrer)
      if (payload.data && typeof payload.data === 'object') {
        Object.keys(payload.data).forEach(function (key) {
          if (BLOCKED_KEYS.test(key)) {
            delete payload.data[key]
            return
          }
          var clean = cleanValue(payload.data[key])
          if (clean === undefined) delete payload.data[key]
          else payload.data[key] = clean
        })
      }
      return payload
    } catch (error) {
      return false
    }
  }

  window.__diffpushBeforeSend = beforeSend
  window.diffpushTrack = function (name, data) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        return window.umami.track(name, data)
      }
    } catch (error) {}
  }

  if (isBlockedPath(window.location.pathname)) return
  if (window.location.hostname !== PRODUCTION_HOST) return
  if (document.querySelector('script[data-website-id="' + WEBSITE_ID + '"]')) return

  var script = document.createElement('script')
  script.async = true
  script.src = SCRIPT_SRC
  script.setAttribute('data-website-id', WEBSITE_ID)
  script.setAttribute('data-domains', PRODUCTION_HOST)
  script.setAttribute('data-do-not-track', 'true')
  script.setAttribute('data-exclude-hash', 'true')
  script.setAttribute('data-before-send', '__diffpushBeforeSend')
  ;(document.head || document.documentElement).appendChild(script)
})()
