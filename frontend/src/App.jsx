import React, { useEffect, useState } from 'react'
import { loadManifest } from './data/curriculum.js'
import { useTracker } from './hooks/useTracker.js'
import { useGitHub } from './hooks/useGitHub.js'
import { Navbar } from './components/layout/Navbar.jsx'
import { MasterProgressCard, RecallCard, SafetyCard } from './components/dashboard/TelemetryDeck.jsx'
import { SidebarBannerSlot } from './components/layout/AmbientAdSlot.jsx'
import { ShieldsNotice } from './components/layout/ShieldsNotice.jsx'
import { CurriculumDirectory } from './components/dashboard/CurriculumDirectory.jsx'
import { PlatformIntro } from './components/dashboard/PlatformIntro.jsx'
import { ViewSwitcher } from './components/dashboard/ViewSwitcher.jsx'
import { CompanyView } from './components/dashboard/CompanyView.jsx'
import { IdentityCard } from './components/dashboard/IdentityCard.jsx'
import { TopicRadar } from './components/dashboard/TopicRadar.jsx'
import { AchievementsCard } from './components/dashboard/AchievementsCard.jsx'
import { DailyChallengeCard, ArenaCard } from './components/dashboard/Sidebar.jsx'
import { SupportCard } from './components/dashboard/SupportCard.jsx'
import { GoalPicker } from './components/modals/GoalPicker.jsx'
import { Workspace } from './components/workspace/Workspace.jsx'
import { GitHubAuthModal } from './components/modals/GitHubAuthModal.jsx'
import { AuthCallback } from './components/modals/AuthCallback.jsx'
import { CommandPalette } from './components/modals/CommandPalette.jsx'
import { ReviewView } from './components/review/ReviewView.jsx'
import { CertView } from './components/review/CertView.jsx'
import { RoomPage } from './components/rooms/RoomPage.jsx'
import { ArenaView } from './components/rooms/ArenaView.jsx'
import { getDailyChallenge } from './data/daily.js'
import { parseRoute, navigate, migrateLegacyHash } from './data/route.js'
import { WeeklyReport } from './components/modals/WeeklyReport.jsx'
import { LandingPage } from './components/marketing/LandingPage.jsx'

const GUEST_KEY = 'builtdiff:guest'

function usePathRoute() {
  const [route, setRoute] = useState(() => { migrateLegacyHash(); return parseRoute() })
  useEffect(() => {
    const onChange = () => setRoute(parseRoute())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return [route, () => navigate('/')]
}

export default function App() {
  const tracker = useTracker()
  const github = useGitHub(tracker)
  const [route, goHub] = usePathRoute()
  const [manifestReady, setManifestReady] = useState(false)
  const [manifestError, setManifestError] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [view, setView] = useState('curriculum')
  const [guest, setGuest] = useState(() => {
    try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false }
  })

  const enterGuest = () => {
    try { localStorage.setItem(GUEST_KEY, '1') } catch {}
    setGuest(true)
  }

  // Successful OAuth clears the guest flag — the token is the identity now.
  useEffect(() => {
    if (github.connected && guest) {
      try { localStorage.removeItem(GUEST_KEY) } catch {}
      setGuest(false)
    }
  }, [github.connected, guest])

  useEffect(() => {
    loadManifest().then(() => setManifestReady(true)).catch((e) => setManifestError(e.message))
  }, [])

  // Full-tab OAuth return: /auth/callback stashes the code in sessionStorage
  // (same-window postMessage has no listener), so the boot exchange runs here.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let code = null
      try { code = sessionStorage.getItem('builtdiff:oauth-code') } catch {}
      if (!code) return
      try { sessionStorage.removeItem('builtdiff:oauth-code') } catch {}
      if (github.connected) return
      try {
        const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
        const res = await fetch(`${API}/api/auth/github/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail ?? 'Exchange failed')
        if (!cancelled) await github.connect(data.access_token)
      } catch {}
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recall nudge: once per session, if cards are due and reminders were opted in.
  useEffect(() => {
    if (!manifestReady || !tracker.ready) return
    try {
      if (Notification?.permission !== 'granted') return
      if (sessionStorage.getItem('builtdiff:nudged')) return
      const due = tracker.getDueCards().length
      if (due > 0) {
        sessionStorage.setItem('builtdiff:nudged', '1')
        new Notification('DiffPush recall', { body: `${due} card${due === 1 ? '' : 's'} due — 5 minutes keeps the streak meaningful.` })
      }
    } catch {}
  }, [manifestReady, tracker.ready])

  // Global keyboard-first triggers: Cmd/Ctrl+K palette.
  // (Cmd+R deliberately untouched — browsers reserve it for reload.)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    const onPaletteEvent = () => setPaletteOpen(true)
    const onConnectEvent = () => setAuthOpen(true)
    const onReportEvent = () => setReportOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('builtdiff:palette', onPaletteEvent)
    window.addEventListener('builtdiff:connect', onConnectEvent)
    window.addEventListener('builtdiff:report', onReportEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('builtdiff:palette', onPaletteEvent)
      window.removeEventListener('builtdiff:connect', onConnectEvent)
      window.removeEventListener('builtdiff:report', onReportEvent)
    }
  }, [])

  // Route content resolves first; global modals mount once below so auth/palette
  // work identically on every route (previously the auth modal only existed
  // on the dashboard branch — Connect buttons elsewhere fired into the void).
  // Front-door rules:
  // - /dashboard is PUBLIC (logged-out devices included) so ad units are
  //   discoverable without login; interactive bits degrade to Connect prompts.
  // - logged-in visits to / collapse to /dashboard (see redirect below).
  // - everything else keeps the auth guard (OAuth callback + public
  //   certificate pages stay outside it — no redirect loops, resume links work).
  const isAuthenticated = github.connected || guest
  const resolving = Boolean(github.token && !github.profile && !github.error) && !guest

  // Logged-in visits to / collapse to the public dashboard.
  useEffect(() => {
    if (route.name === 'hub' && isAuthenticated) navigate('/dashboard', { replace: true })
  }, [route.name, isAuthenticated])

  let content = null
  let chrome = 'bare' // 'bare' | 'hub'
  if (route.name === 'callback') {
    content = <AuthCallback />
  } else if (route.name === 'user') {
    // Public certificate pages stay outside the guard (resume links work logged-out).
    content = <CertView username={route.username} onBack={goHub} />
  } else if (route.name === 'dashboard' || (route.name === 'hub' && isAuthenticated)) {
    chrome = 'hub'
  } else if (!isAuthenticated) {
    content = (resolving || !manifestReady) ? (
      <div className="min-h-screen bg-canvas text-slate-200 flex items-center justify-center">
        <p className="font-mono text-[13px] text-slate-500">
          {manifestError ? `Manifest failed: ${manifestError}` : 'Loading DiffPush…'}
        </p>
      </div>
    ) : (
      <LandingPage onConnect={() => setAuthOpen(true)} onGuest={enterGuest} />
    )
  } else if (route.name === 'arena') {
    content = <ArenaView code={route.code} tracker={tracker} github={github} onBack={goHub} />
  } else if (route.name === 'rooms' || route.name === 'room') {
    content = <RoomPage code={route.name === 'room' ? route.code : null} query={route.query ?? ''} tracker={tracker} github={github} onBack={goHub} />
  } else if (route.name === 'review' && manifestReady) {
    content = <ReviewView tracker={tracker} onBack={goHub} />
  } else if (route.name === 'solve' && manifestReady) {
    content = <Workspace slug={route.slug} tracker={tracker} github={github} onBack={goHub} />
  } else {
    chrome = 'hub'
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-200">
      {chrome === 'hub' ? (
        <>
          <Navbar tracker={tracker} github={github} onPalette={() => setPaletteOpen(true)} onConnect={() => setAuthOpen(true)} />
          <main className="pt-16">
            <div className="max-w-[1400px] mx-auto px-4 py-5">
              {!manifestReady ? (
                <div className="card p-10 text-center font-mono text-[13px] text-slate-500">
                  {manifestError ? `Manifest failed: ${manifestError} — run npm run build:manifest` : 'Loading 369 problems...'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                  {/* main column: manifesto + views + curriculum */}
                  <div className="col-span-1 lg:col-span-8 min-w-0 flex flex-col gap-4">
                    <PlatformIntro />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <TopicRadar tracker={tracker} />
                      <AchievementsCard tracker={tracker} />
                      <ArenaCard github={github} />
                    </div>
                    <ViewSwitcher active={view} onChange={setView} />
                    {view === 'companies' ? <CompanyView tracker={tracker} /> : (
                      <>
                        <DailyChallengeCard tracker={tracker} />
                        <CurriculumDirectory tracker={tracker} />
                      </>
                    )}
                  </div>
                  {/* command-center sidebar: daily action blocks only */}
                  <div className="col-span-1 lg:col-span-4 min-w-0 lg:sticky lg:top-24 flex flex-col gap-4">
                <IdentityCard tracker={tracker} github={github} />
                <MasterProgressCard tracker={tracker} />
                <SidebarBannerSlot />
                <RecallCard tracker={tracker} />
                <SafetyCard tracker={tracker} />
                <SupportCard />
              </div>
                </div>
              )}
            </div>
          </main>
        </>
      ) : content}
      {authOpen && <GitHubAuthModal github={github} onClose={() => setAuthOpen(false)} />}
      {paletteOpen && <CommandPalette tracker={tracker} github={github} onClose={() => setPaletteOpen(false)} />}
      {reportOpen && <WeeklyReport tracker={tracker} onClose={() => setReportOpen(false)} />}
      {chrome === 'hub' && tracker.ready && !tracker.goal && <GoalPicker onPick={(g) => tracker.setGoal(g)} />}
      <ShieldsNotice />
    </div>
  )
}
