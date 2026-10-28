import React from 'react'
import { navigate } from '../../data/route.js'

const UPDATED = 'October 28, 2026'

function Section({ title, children }) {
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold text-slate-100">{title}</h2>
      <div className="mt-1.5 text-[13px] leading-relaxed text-slate-400 space-y-2">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas text-slate-200 flex flex-col">
      <header className="h-16 px-4 sm:px-5 flex items-center border-b border-border max-w-[800px] w-full mx-auto">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }} className="font-mono text-[14px] font-bold tracking-tight">
          diff<span className="text-diff-emerald">push</span>
        </a>
        <button onClick={() => navigate('/')} className="btn-ghost ml-auto px-3 h-8 rounded-md text-[13px] text-slate-300">
          Back to app
        </button>
      </header>
      <main className="flex-1 w-full max-w-[800px] mx-auto px-4 py-10">
        <p className="font-mono text-[11px] tracking-wider text-diff-emerald">PRIVACY</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100">What DiffPush stores, and where</h1>
        <p className="mt-2 text-[13px] text-slate-500">Last updated {UPDATED}. Plain English, no dark patterns.</p>

        <Section title="Everything lives on your device">
          <p>
            Solutions, test results, progress, streaks, recall cards, and settings are stored in your browser's
            localStorage and IndexedDB. There is no DiffPush account database, and we don't collect your practice
            history.
          </p>
        </Section>

        <Section title="GitHub connection">
          <p>
            If you connect GitHub, the OAuth access token is kept in your browser and sent only to the DiffPush API to
            read your profile and push accepted solutions to a repository you own. Tokens are never logged or shared.
            Disconnecting GitHub removes the token from this device.
          </p>
          <p>
            The API is used for your profile, repository commits, room presence, and the optional AI coach. Requests
            carry your token only when an action needs it.
          </p>
        </Section>

        <Section title="Ads">
          <p>
            Free access is supported by third-party ad networks (Mondiad and A-ADS). They may set cookies or device
            identifiers and measure performance under their own policies. We don't receive your identity from them.
            Ads can be blocked without losing any product feature.
          </p>
        </Section>

        <Section title="Hosting and logging">
          <p>
            The app is served by Cloudflare Pages. Like most hosts, Cloudflare processes standard request metadata
            (IP address, user agent) to deliver content and block abuse. Separately, the limited analytics described
            below are loaded directly by your browser.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            We use Umami Cloud for aggregate traffic and product analytics. Umami does not use cookies and does not
            build a cross-site profile of you. We send page paths, referrers, UTM campaign parameters, and anonymous
            interaction events such as guest starts, problems opened, test runs, and GitHub connection or commit
            outcomes.
          </p>
          <p>
            We do not send your code, GitHub token, GitHub username, OAuth codes, or raw URL query strings. Analytics
            is blocked on /auth/callback and /ads-verify, and username paths are redacted. Umami Cloud retains Hobby
            data for up to six months. Umami honors Do Not Track. See the{' '}
            <a href="https://umami.is/privacy" target="_blank" rel="noreferrer" className="text-diff-emerald hover:underline">Umami privacy policy</a>.
          </p>
          <p>
            The ad networks described above may still set their own cookies or identifiers; analytics choices do not
            change their behavior.
          </p>
        </Section>

        <Section title="Your controls">
          <p>
            Clear site data in your browser to erase everything DiffPush stored locally. To remove pushed work, delete
            the repository or commits on GitHub — those commits belong to your account, not ours.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or a data request: reach out on X at{' '}
            <a href="https://x.com/dushyanth168" target="_blank" rel="noreferrer" className="text-diff-emerald hover:underline">@dushyanth168</a>{' '}
            or open an issue on{' '}
            <a href="https://github.com/dushyanth96/diffpush" target="_blank" rel="noreferrer" className="text-diff-emerald hover:underline">GitHub</a>.
          </p>
        </Section>
      </main>
    </div>
  )
}
