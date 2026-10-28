import { useSeo, SITE_URL } from '../../hooks/useSeo.js'

function titleCase(slug = '') {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Problem'
}

const NOINDEX = 'noindex, nofollow'
const NOINDEX_FOLLOW = 'noindex, follow'

/**
 * Baseline metadata for every client-rendered route. Static marketing and
 * problem pages are prerendered at build time; this keeps SPA navigations and
 * private routes from inheriting the homepage canonical.
 */
export function RouteSeo({ route }) {
  const page = (() => {
    switch (route.name) {
      case 'dashboard':
        return {
          title: 'Progress dashboard — DiffPush',
          description: 'Track A2Z DSA progress, streaks, topic coverage, and recall cards in DiffPush.',
          canonical: `${SITE_URL}/dashboard`,
          robots: NOINDEX,
        }
      case 'solve':
        return {
          title: `${titleCase(route.slug)} — DiffPush`,
          description: `Solve ${titleCase(route.slug)} with local test cases, then auto-commit the accepted solution to GitHub.`,
          canonical: `${SITE_URL}/p/${route.slug}/`,
          robots: NOINDEX_FOLLOW,
        }
      case 'rooms':
        return {
          title: 'Study rooms — DiffPush',
          description: 'Join a DiffPush study room and solve A2Z DSA problems alongside other learners.',
          canonical: `${SITE_URL}/room`,
          robots: NOINDEX,
        }
      case 'room':
        return {
          title: `Study room ${route.code} — DiffPush`,
          description: 'A shared DiffPush study room for A2Z DSA practice.',
          canonical: `${SITE_URL}/room/${route.code}`,
          robots: NOINDEX,
        }
      case 'arena':
        return {
          title: `Arena ${route.code} — DiffPush`,
          description: 'A timed DiffPush arena for A2Z DSA practice.',
          canonical: `${SITE_URL}/room/${route.code}/arena`,
          robots: NOINDEX,
        }
      case 'review':
        return {
          title: 'Recall review — DiffPush',
          description: 'Review due A2Z DSA problems with Leitner spaced repetition.',
          canonical: `${SITE_URL}/review`,
          robots: NOINDEX,
        }
      case 'user':
        return {
          title: `${route.username} — DiffPush certificate`,
          description: `Public DiffPush practice certificate for ${route.username}.`,
          canonical: `${SITE_URL}/u/${route.username}`,
          robots: NOINDEX,
        }
      case 'callback':
        return {
          title: 'Signing in — DiffPush',
          description: 'Completing GitHub sign-in for DiffPush.',
          canonical: `${SITE_URL}/auth/callback`,
          robots: NOINDEX,
        }
      case 'ads-verify':
        return {
          title: 'Ad verification — DiffPush',
          description: 'Static ad-unit verification page for DiffPush.',
          canonical: `${SITE_URL}/ads-verify`,
          robots: NOINDEX,
        }
      case 'privacy':
        return {
          title: 'Privacy — DiffPush',
          description: 'What DiffPush stores, where it lives, and how to erase local progress, GitHub tokens, and pushed commits.',
          canonical: `${SITE_URL}/privacy/`,
          robots: 'index, follow',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Privacy — DiffPush',
            url: `${SITE_URL}/privacy/`,
            isPartOf: { '@id': `${SITE_URL}/#website` },
            about: { '@id': `${SITE_URL}/#app` },
          },
        }
      case 'notfound':
        return {
          title: 'Page not found — DiffPush',
          description: 'This page does not exist. Browse the A2Z DSA sheet or return to DiffPush.',
          robots: NOINDEX,
        }
      case 'hub':
      default:
        return {
          title: 'DiffPush — A2Z DSA Sheet Tracker & In-Browser Runner',
          description: 'Practice 369 A2Z DSA problems with real tests in your browser. Auto-commit solutions to GitHub, review with spaced repetition. Free, no signup.',
          canonical: `${SITE_URL}/`,
          robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        }
    }
  })()

  useSeo(page)
  return null
}
