import { createElement, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FunctionsHttpError, type Session } from '@supabase/supabase-js'
import { ParticipantView, ParticipantsAudio, StreamCall, StreamVideo, useCallStateHooks } from '@stream-io/video-react-sdk'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import { isSupabaseConfigured, supabase, type UserProfile } from './lib/supabase'
import { isNativeApp } from './lib/platform'
import { connectGetStreamBattle, connectTestBattleOpponent, type StreamConnection } from './lib/getstream'
import { BattleAudience, DirectInbox } from './BattleAudience'
import { BattleArenaLayout } from './BattleArenaLayout'
import { InAppNotifications } from './InAppNotifications'
import { LandingLiveBattles } from './LandingLiveBattles'
import { playUiSound } from './lib/sound'
import { setPageMeta } from './lib/seo'
import heroMark from './assets/mai-life-wars-mark.svg'
import './App.css'
import './cotton-candy-theme.css'
import './test-battle.css'


type BattleFormat = '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | '6v6'
type BattleMode = 'standard' | 'fast' | 'slow' | 'state'
type PublicPage = 'about' | 'how-battles-work' | 'safety' | 'privacy' | 'terms' | 'community-guidelines'

const formats: BattleFormat[] = ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6']
const states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']
const stateCodes: Record<string, string> = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' }
const modes: { id: BattleMode; title: string; subtitle: string; detail: string; icon: string }[] = [
  { id: 'standard', title: 'Standard', subtitle: '3:00 battle', detail: 'One displayed second per real second.', icon: '◷' },
  { id: 'fast', title: 'Fast Mode', subtitle: '3:00 battle', detail: 'A three-minute server-timed round with a fast-paced battle format.', icon: 'ϟ' },
  { id: 'slow', title: 'Slow Mode', subtitle: '6-minute round', detail: 'The displayed timer drops once every two real seconds.', icon: '◴' },
  { id: 'state', title: 'State Battle', subtitle: 'Rep your state', detail: 'Choose a state and show it above your fighter card.', icon: '⌖' },
]

async function battleRequestErrorMessage(error: unknown, data: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload: unknown = await error.context.clone().json()
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
    } catch (parseError) {
      console.error('[Battle matchmaking] Could not read the function error response', parseError)
    }
  }
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error
  return error instanceof Error ? error.message : fallback
}

const pageCopy: Record<PublicPage, { title: string; description: string; eyebrow: string; body: string[] }> = {
  about: { title: 'A new arena for live creators', description: 'Discover Mai Live Wars, the MAI Corp creator battle app for 1v1 through 6v6 competition.', eyebrow: 'The MAI Corp experience', body: ['Mai Live Wars is a live creator competition app built around real-time battles, skill progression, state pride, and audience participation.', 'Creators can enter 1v1 through 6v6 formats, choose battle modes, compete for points, and build a public competitive record. The app is designed to make every match feel like an event.', 'Mai Live Wars is an independent MAI Corp product with its own accounts, safety systems, virtual currency ledger, and live battle infrastructure.'] },
  'how-battles-work': { title: 'How battles work', description: 'Learn how Mai Live Wars Standard, Fast, Slow, State, and 1v1 through 6v6 battles work.', eyebrow: 'Know the rules', body: ['Choose a team format from 1v1 through 6v6, then select Standard, Fast, Slow, or State Battle where available.', 'Standard and Fast battles run for three minutes of real time. Slow Mode displays three minutes at half speed, for a six-minute real-time round.', 'After three completed battles in a row without receiving a gift, users must wait 30 minutes after the third battle ends before starting another battle. Administrators and the designated administrator tester are exempt.', 'Battle scoring and results are validated by the service. Users cannot set their own score or claim a win from their device. The app does not offer sudden-death rounds or rematches in the initial release.'] },
  safety: { title: 'Safety in the arena', description: 'Learn about Mai Live Wars AI-assisted live audio safety, reporting, blocking, and battle enforcement.', eyebrow: 'Safety comes first', body: ['Mai Live Wars uses automated moderation to help detect credible threats, self-harm content, and prohibited sexual content during live battles. Automated detection can make mistakes, so enforcement must account for context and speaker attribution.', 'When a confirmed high-confidence violation occurs, the participant may be removed from the active battle. In 1v1, the eligible opponent can receive a forfeit win. In team battles, the offending participant is removed while the remaining battle continues when possible.', 'Users can report or block accounts. Moderation evidence is access-restricted and retained only according to the published retention policy. AI moderation supplements, rather than replaces, platform safety operations.'] },
  privacy: { title: 'Privacy notice', description: 'Read the Mai Live Wars privacy principles, data use, recording consent, and account controls.', eyebrow: 'Your data, your choices', body: ['Mai Live Wars uses account, profile, battle, safety, and transaction information to operate the app, protect users, process purchases and eligible payouts, and maintain reliable records.', 'Mai Live Wars does not sell personal information to third parties. Service providers may process information on the app’s behalf only as needed to provide approved services, subject to applicable agreements and law.', 'Battle content may be recorded for Mai Live Wars advertising only when the relevant participant has expressly opted in and the battle recording notice is shown. Marketing-recording consent is separate from acceptance of the Terms and Privacy Notice and can be withdrawn for future recordings. Do not record a participant for advertising when consent is absent or unclear.', 'Users can request account deletion from Profile settings. Certain records may need to be retained for security, fraud prevention, legal compliance, or financial reconciliation where permitted or required by law.'] },
  terms: { title: 'Terms of service', description: 'Review the Mai Live Wars account, battle, currency, creator earnings, and acceptable use terms.', eyebrow: 'Terms of service', body: ['By creating an account, users agree to the Terms of Service, Privacy Notice, and Community Guidelines shown during registration. The app must present the full current policy text and version before account creation.', 'Bullets are in-app virtual currency. Purchased Bullets, battle points, creator earnings, and withdrawable earnings are distinct balances and may be subject to different rules. A purchase does not automatically create a cashout entitlement.', 'Creator cashout requests are accepted for processing on Monday and Friday, subject to eligibility, verification, payment provider availability, fraud checks, and the current payout policy. The displayed minimum is 3,750 eligible earnings Bullets for a $10 withdrawal, subject to approved rules.', 'Mai Live Wars may remove participants from a battle for confirmed safety violations, maintain audit records, restrict abusive accounts, and update product features or rules in accordance with applicable law.'] },
  'community-guidelines': { title: 'Community guidelines', description: 'Read the Mai Live Wars community rules for threats, self-harm, sexual content, harassment, and fair battles.', eyebrow: 'Play fair', body: ['Do not threaten to kill, shoot, attack, or injure another person. Do not encourage suicide or self-harm. Prohibited sexually explicit content, sexual harassment, and exploitative content are not allowed.', 'Do not harass, stalk, impersonate, dox, threaten, or coordinate abuse against other users. Do not manipulate battle scores, abuse purchases or refunds, exploit cashouts, or interfere with the streaming service.', 'Automated moderation may act on live content. Users can appeal enforcement where an appeal option is available. False reports, attempts to evade restrictions, and attempts to exploit moderation systems may result in account restrictions.'] },
}

function Glyph({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={`glyph ${className}`}>{children}</span>
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="Mai Live Wars home">
    <span className="brand-emblem"><img src={heroMark} alt="" /></span>
    <span className="brand-copy"><strong>MAI <i>LIVE WARS</i></strong><small>AN MAI CORP PRODUCT</small></span>
  </Link>
}

const CURRENT_YEAR = new Date().getFullYear()

function useCurrentDate() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return currentDate
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [authReady, setAuthReady] = useState(!supabase)

  const refreshProfile = useCallback(async (userId?: string) => {
    if (!supabase || !userId) { setProfile(null); return null }
    setProfileLoading(true)
    const { data, error } = await supabase.from('user_profiles')
      .select('id,user_id,username,display_name,avatar_url,bio,gender,city,state_code,role,profile_complete,marketing_recording_consent')
      .eq('user_id', userId)
      .maybeSingle()
    setProfileLoading(false)
    if (error) { console.error('Profile lookup failed:', error.message); setProfile(null); return null }
    setProfile(data as UserProfile | null)
    return data as UserProfile | null
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session?.user) await refreshProfile(data.session.user.id)
      if (alive) setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) window.setTimeout(() => void refreshProfile(nextSession.user.id), 0)
      else setProfile(null)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [refreshProfile])

  const play = useCallback((kind: 'tap' | 'success' | 'battle' | 'warning' = 'tap') => { if (soundEnabled) playUiSound(kind) }, [soundEnabled])
  if (!authReady) return <div className="boot-screen"><div className="boot-mark">M</div><span>Initializing the arena</span><div className="boot-line" /></div>

  const appShell = !session ? <LandingPage play={play} /> : profileLoading ? <LoadingScreen /> : !profile?.profile_complete ? <Navigate to="/create-profile" replace /> : <AppShell session={session} profile={profile} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} play={play} onProfileRefresh={() => refreshProfile(session.user.id)} onSignOut={async () => { await supabase?.auth.signOut(); setSession(null); setProfile(null) }} />

  return <BrowserRouter>
    <Routes>
      <Route path="/auth" element={session ? <Navigate to={profile?.profile_complete ? '/' : '/create-profile'} replace /> : <AuthPage onAuthenticated={async (next) => { setSession(next); await refreshProfile(next.user.id) }} play={play} />} />
      <Route path="/reset-password" element={<ResetPasswordPage play={play} />} />
      <Route path="/paypal-return" element={<PayPalReturnPage play={play} />} />
      <Route path="/create-profile" element={!session ? <Navigate to="/auth" replace /> : profile?.profile_complete ? <Navigate to="/" replace /> : <ProfileSetupPage session={session} onSaved={async () => { await refreshProfile(session.user.id); play('success') }} play={play} />} />
      <Route path="/admin/*" element={!session ? <Navigate to="/auth" replace /> : profileLoading ? <LoadingScreen /> : profile?.role !== 'admin' ? <AccessDenied /> : <AdminDashboard profile={profile} play={play} />} />
      <Route path="/test-battle" element={!session ? <Navigate to="/auth" replace /> : profileLoading ? <LoadingScreen /> : profile?.role !== 'admin' ? <AccessDenied /> : !profile.profile_complete ? <Navigate to="/create-profile" replace /> : <TestBattleLauncher />} />
      <Route path="/battle/:battleId" element={!session ? <Navigate to="/auth" replace /> : !profile?.profile_complete ? <Navigate to="/create-profile" replace /> : <BattlePage profile={profile} play={play} />} />
      <Route path="/" element={appShell} />
      <Route path="/battles" element={appShell} />
      <Route path="/rankings" element={appShell} />
      <Route path="/profile" element={appShell} />
      <Route path="/messages" element={!session ? <Navigate to="/auth" replace /> : profileLoading ? <LoadingScreen /> : !profile?.profile_complete ? <Navigate to="/create-profile" replace /> : appShell} />
      {Object.keys(pageCopy).map((path) => <Route key={path} path={`/${path}`} element={<PublicInfoPage page={path as PublicPage} />} />)}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
}

function LandingPage({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const location = useLocation()
  useEffect(() => { setPageMeta('Live Creator Battle Arena', 'Mai Live Wars is a live creator battle arena for 1v1 through 6v6 battles, fast mode, slow mode, and state battles.', location.pathname) }, [location.pathname])
  return <div className="public-shell landing-cotton-candy">
    <PublicHeader />
    <main className="landing-main">
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="live-label"><span className="live-dot" /> MAI CORP · EARLY ACCESS MVP</div>
          <h1>Make your<br /><span>moment legendary.</span></h1>
          <p>Step into a new kind of live creator arena. Challenge solo, bring your squad, rep your state, and make every second count.</p>
          <div className="hero-actions"><Link className="button button-primary" to="/auth" onClick={() => play('battle')}>Enter the arena <Glyph>↗</Glyph></Link><Link className="button button-ghost" to="/how-battles-work">Explore battle modes</Link></div>
          <div className="hero-proof"><span><Glyph>◉</Glyph> Real-time battles</span><span><Glyph>✦</Glyph> Six team formats</span><span><Glyph>⌖</Glyph> State pride</span></div>
        </div>
        <div className="hero-art" aria-label="Mai Live Wars neon battle arena illustration">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-core"><div className="core-ring"><span>VS</span></div><div className="core-label top">FIGHTER 01</div><div className="core-label bottom">FIGHTER 02</div></div>
          <div className="float-card float-card-a"><span className="tiny-avatar blue">A</span><div><b>ASTRA</b><small>READY TO FIGHT</small></div><span className="mini-pulse" /></div>
          <div className="float-card float-card-b"><span className="tiny-avatar purple">N</span><div><b>NOVA</b><small>CHALLENGER</small></div><span className="mini-pulse purple-pulse" /></div>
          <div className="hero-stats"><strong>01 <small>VS</small> 01</strong><span>YOUR ARENA. YOUR MOMENT.</span></div>
          <div className="art-spark spark-a">✦</div><div className="art-spark spark-b">✧</div><div className="art-spark spark-c">+</div>
        </div>
      </section>
      <LandingLiveBattles />
      <section className="landing-formats"><div className="section-intro"><span className="eyebrow">CHOOSE YOUR FORMAT</span><h2>One arena. <span>Six ways to battle.</span></h2><p>Go head-to-head or bring the whole crew.</p></div><div className="format-showcase">{formats.map((format, index) => <Link to="/auth" key={format} onClick={() => play('tap')} className={`format-tile tile-${index + 1}`}><span className="format-number">0{index + 1}</span><strong>{format}</strong><small>{Number(format[0]) * 2} fighters</small><span className="tile-arrow">↗</span></Link>)}</div></section>
      <section className="landing-modes"><div><span className="eyebrow">PLAY YOUR WAY</span><h2>Pick your <span>tempo.</span></h2><p>Quick-fire rounds, strategic long plays, and battles that put your home state on the map.</p></div><div className="mode-preview-grid">{modes.map((mode) => <article className="mode-preview" key={mode.id}><span className={`mode-icon ${mode.id}`}>{mode.icon}</span><strong>{mode.title}</strong><small>{mode.subtitle}</small></article>)}</div></section>
    </main>
    <PublicFooter />
  </div>
}

function PublicHeader() { return <header className="public-header"><Brand /><nav><Link to="/how-battles-work">How it works</Link><Link to="/safety">Safety</Link><Link to="/about">About</Link></nav><Link to="/auth" className="button button-small button-primary">Sign in <Glyph>↗</Glyph></Link></header> }
function PublicFooter() { return <footer className="public-footer"><Brand compact /><div className="footer-links"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/community-guidelines">Community Guidelines</Link><Link to="/safety">Safety</Link></div><small>© {CURRENT_YEAR} MAI Corp. Mai Live Wars. All rights reserved.</small></footer> }

function AuthPage({ onAuthenticated, play }: { onAuthenticated: (session: Session) => Promise<void>; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [guidelines, setGuidelines] = useState(false)
  const [recordingConsent, setRecordingConsent] = useState(false)
  const [showFullConsent, setShowFullConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => { setPageMeta(mode === 'signup' ? 'Create your account' : 'Sign in', 'Create a Mai Live Wars account to join live creator battles.', location.pathname) }, [mode, location.pathname])

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('')
    if (!supabase) { setMessage('Connect Supabase to enable real account creation. Add the public project URL and anon key to your local environment.'); return }
    if (mode === 'signup' && !(terms && privacy && guidelines)) { setMessage('Please review and accept the Terms, Privacy Notice, and Community Guidelines before creating an account.'); setShowFullConsent(true); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { terms_accepted: terms, privacy_accepted: privacy, community_guidelines_accepted: guidelines, consent_version: '2026-10-12', marketing_recording_consent: recordingConsent }, emailRedirectTo: `${window.location.origin}/auth` } })
        if (error) throw error
        if (data.session) { await onAuthenticated(data.session); navigate('/create-profile') }
        else setMessage('Check your email to verify your account. Once verified, sign in to create your fighter profile.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        if (data.session) { await onAuthenticated(data.session); navigate('/') }
      }
      play('success')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.') }
    finally { setBusy(false) }
  }

  async function forgotPassword() {
    if (!supabase) { setMessage('Connect Supabase to enable password recovery.'); return }
    if (!email.trim()) { setMessage('Enter your account email first.'); return }
    setBusy(true)
    const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL?.trim() || 'https://mai-live-batttles.onrender.com').replace(/\/+$/, '')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${publicAppUrl}/reset-password` })
    setBusy(false)
    setMessage(error ? error.message : 'If an account exists for that address, a password reset link has been sent.')
  }

  return <div className="auth-page"><div className="auth-visual"><Brand /><div className="auth-visual-copy"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>Built for the<br /><span>bold ones.</span></h1><p>Find your format. Rep your state. Own your moment.</p><div className="auth-visual-stat"><span className="live-dot" /> MAI CORP · LIVE CREATOR COMPETITION</div></div><div className="auth-visual-art"><div className="auth-orbit" /><div className="auth-vs">VS</div><span className="auth-side side-a">MAI</span><span className="auth-side side-b">WARS</span></div><div className="auth-visual-bottom">Mai Live Wars <span>•</span> ALL RIGHTS RESERVED</div></div>
    <main className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-box"><div className="auth-heading"><span className="eyebrow">{mode === 'signup' ? 'JOIN THE ARENA' : 'WELCOME BACK'}</span><h2>{mode === 'signup' ? 'Create your account' : 'Sign in to Life Wars'}</h2><p>{mode === 'signup' ? 'Your fighter profile is the next step after verification.' : 'Your next battle is one sign-in away.'}</p></div><form onSubmit={submit} className="form-stack"><label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} minLength={mode === 'signup' ? 8 : undefined} required /></label>
      {mode === 'signup' && <div className="consent-panel"><div className="consent-title"><Glyph>▤</Glyph><div><strong>Before you create your account</strong><small>Review the policies that govern your use of Mai Live Wars.</small></div></div><button type="button" className="text-button" onClick={() => setShowFullConsent(!showFullConsent)}>{showFullConsent ? 'Hide policy summaries' : 'Read consent and policy summaries'} <Glyph>{showFullConsent ? '−' : '+'}</Glyph></button>{showFullConsent && <div className="policy-summary"><h4>Terms of Service</h4><p>Use the app lawfully, respect other creators, follow battle rules, and understand that Bullets, battle points, earnings, and cashout eligibility are distinct.</p><h4>Privacy Notice</h4><p>We process account, profile, battle, safety, and transaction data to operate the app. Mai Live Wars does not sell personal information to third parties.</p><h4>Community Guidelines</h4><p>Threats, encouragement of self-harm, prohibited sexual content, harassment, fraud, and battle manipulation are not allowed.</p><p className="policy-note">These summaries do not replace the full policies linked below. Review each complete policy before acceptance.</p></div>}<label className="check-row"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>I agree to the <Link to="/terms" target="_blank">Terms of Service</Link>.</span></label><label className="check-row"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span>I acknowledge the <Link to="/privacy" target="_blank">Privacy Notice</Link>.</span></label><label className="check-row"><input type="checkbox" checked={guidelines} onChange={(e) => setGuidelines(e.target.checked)} /><span>I agree to follow the <Link to="/community-guidelines" target="_blank">Community Guidelines</Link>.</span></label><div className="recording-consent"><label className="check-row"><input type="checkbox" checked={recordingConsent} onChange={(e) => setRecordingConsent(e.target.checked)} /><span><strong>Optional advertising recording consent.</strong> I consent to promotional recording of my battle participation solely for Mai Live Wars advertising when that feature is enabled and the required in-battle consent checks are satisfied. This content is not sold or licensed to third parties for their independent use. I can withdraw consent for future recordings.</span></label><small>Optional. If you do not consent, you can still create an account. Recorded promotional battles must include only participants who have opted in.</small></div></div>}
      {message && <div className="inline-message" role="status">{message}</div>}<button className="button button-primary button-full" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <Glyph>↗</Glyph></button></form>{mode === 'login' && <button type="button" className="text-button forgot-button" onClick={forgotPassword} disabled={busy}>Forgot password?</button>}<div className="auth-switch"><span>{mode === 'signup' ? 'Already have an account?' : 'New to the arena?'}</span><button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage('') }}>{mode === 'signup' ? 'Sign in' : 'Create account'}</button></div><p className="auth-disclaimer">By continuing, you confirm that the information you provide is accurate. Age and eligibility requirements apply.</p></div><footer className="auth-footer"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/safety">Safety</Link><span>© {CURRENT_YEAR} MAI Corp. All rights reserved.</span></footer></main></div>
}

function ResetPasswordPage({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate()
  async function submit(event: FormEvent) { event.preventDefault(); if (password.length < 8 || password !== confirm) { setMessage('Use at least 8 characters and make sure both passwords match.'); return } if (!supabase) { setMessage('Supabase is not configured.'); return } setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false); if (error) setMessage(error.message); else { setMessage('Password updated. You can sign in with your new password.'); play('success'); window.setTimeout(() => navigate('/auth'), 900) } }
  return <div className="center-page"><Brand /><div className="auth-box reset-box"><span className="eyebrow">ACCOUNT RECOVERY</span><h2>Choose a new password</h2><p>Use a password you do not use on other services.</p><form onSubmit={submit} className="form-stack"><label>New password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><label>Confirm new password<input type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>{message && <div className="inline-message">{message}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></div><PublicFooter /></div>
}

function ProfileSetupPage({ session, onSaved, play }: { session: Session; onSaved: () => Promise<void>; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [username, setUsername] = useState(''); const [displayName, setDisplayName] = useState(''); const [gender, setGender] = useState(''); const [city, setCity] = useState(''); const [state, setState] = useState(''); const [bio, setBio] = useState(''); const [avatar, setAvatar] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const recordingConsent = Boolean(session.user.user_metadata?.marketing_recording_consent)
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(''); if (!supabase) { setMessage('Supabase is not configured.'); return } if (!avatar) { setMessage('Choose a profile image to continue.'); return } if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { setMessage('Username must be 3–20 characters using letters, numbers, and underscores.'); return } setBusy(true)
    try { const fileExt = avatar.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`; const upload = await supabase.storage.from('profile-avatars').upload(path, avatar, { upsert: false, contentType: avatar.type }); if (upload.error) throw new Error(`Avatar upload failed: ${upload.error.message}. Create the profile-avatars storage bucket and its RLS policies first.`); const { data: urlData } = supabase.storage.from('profile-avatars').getPublicUrl(path); const { error } = await supabase.from('user_profiles').upsert({ user_id: session.user.id, username: username.toLowerCase(), display_name: displayName.trim(), avatar_path: path, avatar_url: urlData.publicUrl, gender: gender || null, city: city.trim() || null, state_code: state || null, bio: bio.trim() || null, profile_complete: true, marketing_recording_consent: recordingConsent, role: 'user' }, { onConflict: 'user_id' }); if (error) throw error
      const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', session.user.id).single(); if (profile?.id) { const { error: consentError } = await supabase.from('consent_records').insert({ user_profile_id: profile.id, terms_version: '2026-10-12', privacy_version: '2026-10-12', community_guidelines_version: '2026-10-12', accepted_at: new Date().toISOString(), marketing_recording_consent: recordingConsent, recording_consent_version: '2026-10-12' }); if (consentError && !consentError.message.includes('duplicate')) console.warn('Consent record insert needs review:', consentError.message); const { error: recordingHistoryError } = await supabase.from('marketing_recording_consents').insert({ user_profile_id: profile.id, consent_granted: recordingConsent, consent_version: '2026-10-12', source: 'signup', recorded_at: new Date().toISOString(), withdrawn_at: recordingConsent ? null : new Date().toISOString() }); if (recordingHistoryError) console.warn('Recording consent history needs migration:', recordingHistoryError.message) }
      await onSaved(); play('success')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your profile.') } finally { setBusy(false) }
  }
  return <div className="profile-setup-page"><div className="profile-setup-backdrop" /><header className="profile-setup-header"><Brand /><span className="step-pill"><span>01</span> FIGHTER SETUP</span></header><main className="profile-setup-main"><div className="profile-intro"><span className="eyebrow">YOUR IDENTITY. YOUR ARENA.</span><h1>First, meet<br /><span>your fighter.</span></h1><p>Set up your public profile before stepping into a live battle.</p><div className="setup-benefit"><Glyph>✦</Glyph><span>Your profile helps other creators recognize you, find your battles, and represent your state.</span></div></div><form className="profile-setup-card" onSubmit={submit}><div className="card-heading"><div><span className="eyebrow">PROFILE DETAILS</span><h2>Create your profile</h2></div><span className="step-number">01 <small>/ 01</small></span></div><label className="avatar-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAvatar(e.target.files?.[0] || null)} /><span className="avatar-preview">{avatar ? <span>{avatar.name.slice(0, 1).toUpperCase()}</span> : <Glyph>＋</Glyph>}</span><span><strong>{avatar ? avatar.name : 'Upload profile image'}</strong><small>JPG, PNG, or WebP · up to 5 MB</small></span><span className="upload-action">Choose file</span></label><div className="form-two-col"><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourfightername" minLength={3} maxLength={20} required /><small>3–20 letters, numbers, or underscores.</small></label><label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How people know you" maxLength={40} required /></label></div><div className="form-two-col"><label>Gender<select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Choose an option</option><option value="male">Male</option><option value="female">Female</option><option value="prefer_not_to_say">Prefer not to say</option></select><small>Shown on your profile only if you choose to display it.</small></label><label>State<select value={state} onChange={(e) => setState(e.target.value)}><option value="">Choose your state</option>{states.map((name) => <option key={name} value={stateCodes[name]}>{name}</option>)}</select></label></div><label>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" maxLength={80} /></label><label>Bio <span className="optional">OPTIONAL</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the arena what you're about…" maxLength={220} /></label>{message && <div className="inline-message">{message}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Saving profile…' : 'Save profile & enter arena'} <Glyph>↗</Glyph></button><small className="profile-privacy-note">Your profile uses your Mai Live Wars account. Private account and payment details are not displayed publicly.</small></form></main><PublicFooter /></div>
}

function AppShell({ session, profile, soundEnabled, setSoundEnabled, play, onProfileRefresh, onSignOut }: { session: Session; profile: UserProfile; soundEnabled: boolean; setSoundEnabled: (enabled: boolean) => void; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void; onProfileRefresh: () => Promise<unknown>; onSignOut: () => Promise<void> }) {
  const location = useLocation(); const navigate = useNavigate(); const [activeFormat, setActiveFormat] = useState<BattleFormat>('1v1'); const [activeMode, setActiveMode] = useState<BattleMode>('standard'); const [stateChoice, setStateChoice] = useState(profile.state_code || 'TX'); const [showStatePicker, setShowStatePicker] = useState(false); const [notice, setNotice] = useState('')
  useEffect(() => { setPageMeta('Home', 'Explore live Mai Live Wars battles, fast and slow modes, and state competition.', location.pathname) }, [location.pathname])
  const routeTab = location.pathname.startsWith('/battles') ? 'battles' : location.pathname.startsWith('/rankings') ? 'rankings' : location.pathname.startsWith('/profile') ? 'profile' : location.pathname.startsWith('/messages') ? 'messages' : 'home'
  const [bulletBalance, setBulletBalance] = useState(0)
  useEffect(() => {
    const db = supabase
    if (!db) return
    let alive = true
    const loadBalance = () => { void db.from('wallets').select('spendable_bullets').eq('user_profile_id', profile.id).maybeSingle().then(({ data }) => { if (alive) setBulletBalance(Number(data?.spendable_bullets || 0)) }) }
    loadBalance()
    const channel = db.channel(`wallet-tracker-${profile.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_profile_id=eq.${profile.id}` }, () => loadBalance()).subscribe()
    return () => { alive = false; void db.removeChannel(channel) }
  }, [profile.id])
  const enterBattle = async (mode: BattleMode, format = activeFormat, existingBattleId?: string) => {
    if (!supabase) { setNotice('Connect Supabase and deploy the battle Edge Functions before entering a real battle.'); return }
    setNotice(existingBattleId ? 'Joining the selected room…' : 'Finding your next matchup…')
    play('battle')
    const { data, error } = existingBattleId
      ? await supabase.functions.invoke('join-battle', { body: { battleId: existingBattleId, stateCode: stateChoice } })
      : await supabase.functions.invoke('create-battle', { body: { format, mode, stateCode: stateChoice } })
    if (error || !data?.battleId) { const detail = await battleRequestErrorMessage(error, data, 'Unable to enter the battle room.'); setNotice(detail.includes('Failed to send a request') ? `${detail} This does not confirm that the function is missing. Check your browser connection and the Supabase Function logs, then retry.` : detail); return }
    setNotice('')
    navigate(`/battle/${data.battleId}?format=${data.format || format}&mode=${data.mode || mode}&state=${data.stateCode || stateChoice}${data.viewer ? '&viewer=1' : ''}`)
  }
  return <div className={`app-frame ${isNativeApp ? 'platform-native' : 'platform-web'} ${routeTab === 'home' ? 'home-cotton-candy' : ''}`}><div className="app-ambient ambient-one"/><div className="app-ambient ambient-two"/><header className="app-topbar"><Brand compact /><div className="topbar-center"><span className="live-dot"/><span>{isNativeApp ? 'THE CREATOR ARENA' : 'MAI LIVE WARS · WEB ARENA'}</span><i /></div><div className="topbar-actions"><button className={`icon-button ${soundEnabled ? 'is-on' : ''}`} aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'} title="Toggle interface sounds" onClick={() => { setSoundEnabled(!soundEnabled); if (!soundEnabled) playUiSound('success') }}><Glyph>{soundEnabled ? '♫' : '♪'}</Glyph></button><InAppNotifications profileId={profile.id} /><Link className="bullet-wallet" to="/profile" title="Open your Bullet wallet"><span className="bullet-symbol">●</span><strong>{bulletBalance.toLocaleString()}</strong><span className="wallet-placeholder">Bullets</span></Link><button className="avatar-mini" title="Open profile" onClick={() => navigate('/profile')}>{profile.display_name.slice(0, 1).toUpperCase()}</button></div></header>
    <div className="app-layout"><aside className="side-nav"><div className="nav-section-label">ARENA</div><NavLink to="/" active={routeTab === 'home'} icon="⌂" label="Home" /><NavLink to="/battles" active={routeTab === 'battles'} icon="⚔" label={isNativeApp ? 'Battle formats' : 'Live battles'} /><NavLink to="/messages" active={routeTab === 'messages'} icon="▤" label="Messages" /><NavLink to="/rankings" active={routeTab === 'rankings'} icon="♜" label="Rankings" /><NavLink to="/profile" active={routeTab === 'profile'} icon="◉" label="My profile" />{isNativeApp && <><div className="nav-section-label nav-label-spaced">YOUR MODES</div><button className={`side-nav-link ${activeMode === 'fast' ? 'selected' : ''}`} onClick={() => { setActiveMode('fast'); navigate('/'); play('tap') }}><Glyph>ϟ</Glyph><span>Fast mode</span><small>90 sec</small></button><button className={`side-nav-link ${activeMode === 'slow' ? 'selected' : ''}`} onClick={() => { setActiveMode('slow'); navigate('/'); play('tap') }}><Glyph>◴</Glyph><span>Slow mode</span><small>6 min</small></button><button className={`side-nav-link ${activeMode === 'state' ? 'selected' : ''}`} onClick={() => { setActiveMode('state'); setShowStatePicker(true); navigate('/'); play('tap') }}><Glyph>⌖</Glyph><span>State battles</span><small>{stateChoice}</small></button></>}<div className="side-nav-bottom"><div className="user-mini"><div className="avatar-mini large-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</div><div><strong>{profile.display_name}</strong><small>@{profile.username}</small></div></div>{profile.role === 'admin' && <Link to="/admin" className="admin-entry"><Glyph>▦</Glyph> Admin dashboard <Glyph>↗</Glyph></Link>}<button className="side-signout" onClick={() => void onSignOut()}>↪ Sign out</button></div></aside>
    <main className="app-main">{notice && <div className="notice-bar"><Glyph>ⓘ</Glyph>{notice}<button onClick={() => setNotice('')}>×</button></div>}{location.pathname === '/' && <HomePage profile={profile} activeFormat={activeFormat} setActiveFormat={setActiveFormat} activeMode={activeMode} setActiveMode={setActiveMode} stateChoice={stateChoice} setStateChoice={setStateChoice} showStatePicker={showStatePicker} setShowStatePicker={setShowStatePicker} enterBattle={enterBattle} play={play} />}{location.pathname === '/battles' && <BattlesPage activeFormat={activeFormat} setActiveFormat={setActiveFormat} activeMode={activeMode} setActiveMode={setActiveMode} enterBattle={enterBattle} play={play} />}{location.pathname === '/rankings' && <RankingsPage play={play} />}{location.pathname === '/profile' && <ProfilePage profile={profile} session={session} onRefresh={onProfileRefresh} play={play} onSignOut={onSignOut} />}{location.pathname === '/messages' && <DirectInbox profile={profile} />}</main></div><MobileNav active={routeTab} play={play} /><footer className="app-footer"><span>© {CURRENT_YEAR} MAI Corp. Mai Live Wars. All rights reserved.</span><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/safety">Safety</Link><Link to="/community-guidelines">Guidelines</Link></div></footer></div>
}

function NavLink({ to, active, icon, label }: { to: string; active: boolean; icon: string; label: string }) { return <Link to={to} className={`side-nav-link ${active ? 'selected' : ''}`}><Glyph>{icon}</Glyph><span>{label}</span>{active && <i className="nav-active-indicator" />}</Link> }
function MobileNav({ active, play }: { active: string; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) { const items = [{ to: '/', id: 'home', label: 'Home', icon: '⌂' }, { to: '/battles', id: 'battles', label: 'Battles', icon: '⚔' }, { to: '/messages', id: 'messages', label: 'Messages', icon: '▤' }, { to: '/rankings', id: 'rankings', label: 'Ranks', icon: '♜' }, { to: '/profile', id: 'profile', label: 'Profile', icon: '◉' }]; return <nav className="mobile-nav">{items.map((item) => <Link key={item.id} to={item.to} className={active === item.id ? 'active' : ''} onClick={() => play('tap')}><Glyph>{item.icon}</Glyph><small>{item.label}</small></Link>)}</nav> }

function HomePage({ profile, activeFormat, setActiveFormat, activeMode, setActiveMode, stateChoice, setStateChoice, showStatePicker, setShowStatePicker, enterBattle, play }: { profile: UserProfile; activeFormat: BattleFormat; setActiveFormat: (format: BattleFormat) => void; activeMode: BattleMode; setActiveMode: (mode: BattleMode) => void; stateChoice: string; setStateChoice: (state: string) => void; showStatePicker: boolean; setShowStatePicker: (show: boolean) => void; enterBattle: (mode: BattleMode, format?: BattleFormat, existingBattleId?: string) => void; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [stateBattles, setStateBattles] = useState(false)
  const [realRooms, setRealRooms] = useState<any[]>([]); const [loadingRooms, setLoadingRooms] = useState(false)
  useEffect(() => {
    let alive = true
    const db = supabase
    if (!db) return
    const loadRooms = async () => {
      setLoadingRooms(true)
      const { data, error } = await db.from('battles').select('id,format,mode,status,team_a_score,team_b_score,viewer_count,state_code,started_at').eq('is_test', false).in('status', ['waiting', 'live']).order('created_at', { ascending: false }).limit(12)
      if (!alive) return
      if (!error && data) {
        const ids = data.map((room: any) => room.id)
        const { data: participants } = ids.length ? await db.from('battle_participants').select('battle_id,team,state_code').in('battle_id', ids).in('status', ['ready','active']) : { data: [] as any[] }
        const summaries = new Map<string, { a: string[]; b: string[] }>()
        for (const participant of participants || []) {
          if (!participant.state_code) continue
          const summary = summaries.get(participant.battle_id) || { a: [], b: [] }
          const states = participant.team === 'A' ? summary.a : summary.b
          if (!states.includes(participant.state_code)) states.push(participant.state_code)
          summaries.set(participant.battle_id, summary)
        }
        setRealRooms(data.map((room: any) => { const summary = summaries.get(room.id); return { ...room, teamAState: summary?.a.join(' · ') || null, teamBState: summary?.b.join(' · ') || null } }))
      }
      setLoadingRooms(false)
    }
    void loadRooms()
    const channel = db.channel('home-live-battle-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => { void loadRooms() }).subscribe()
    return () => { alive = false; void db.removeChannel(channel) }
  }, [])
  const selectedStateName = states.find((name) => stateCodes[name] === stateChoice) || stateChoice
  return <div className="page-stack home-page-stack"><section className="welcome-strip"><div><span className="eyebrow">WELCOME BACK, FIGHTER</span><h1>Good to see you, <span>{profile.display_name.split(' ')[0]}.</span></h1><p>The arena is yours. Find a matchup and make it count.</p></div><div className="welcome-status"><span className="live-dot"/><div><strong>You're battle-ready</strong><small>Profile complete · Community rules active</small></div></div></section>
    <section className="main-hero-card"><div className="hero-grid-lines"/><div className="hero-card-copy"><div className="eyebrow"><span className="live-dot"/> LIVE BATTLE ARENA</div><h2>Every second<br /><span>has a winner.</span></h2><p>Find your next opponent. Climb the ranks. Leave your mark.</p><button className="button button-primary" onClick={() => enterBattle(activeMode)}><Glyph>⚔</Glyph> {activeMode === 'state' ? 'Enter state battle' : 'Find a battle'} <Glyph>↗</Glyph></button>{profile.role === 'admin' && <Link className="button button-ghost" to="/test-battle">Test 1v1 vs Admin Tester</Link>}<div className="hero-tags"><span><Glyph>◷</Glyph> {activeMode === 'fast' ? '90 sec real time' : activeMode === 'slow' ? '6 min real time' : '3 min displayed'}</span><span><Glyph>✦</Glyph> 1v1—6v6</span></div></div><div className="hero-card-visual"><div className="visual-ring ring-outer"/><div className="visual-ring ring-middle"/><div className="visual-ring ring-inner"/><div className="versus-mark">VS</div><div className="hero-fighter fighter-left"><span>A</span><small>CHALLENGER</small></div><div className="hero-fighter fighter-right"><span>W</span><small>OPPONENT</small></div><div className="visual-energy energy-a"/><div className="visual-energy energy-b"/></div><div className="hero-card-bottom"><span>MAI CORP ORIGINAL</span><span>PLAY LOUD. PLAY FAIR.</span></div></section>
    <section className="format-section"><div className="section-title-row"><div><span className="eyebrow">PICK YOUR FORMAT</span><h2>Choose your <span>battle.</span></h2></div><Link to="/battles" className="inline-link">All battle modes <Glyph>↗</Glyph></Link></div><div className="format-selector">{formats.map((format, index) => <button key={format} onClick={() => { setActiveFormat(format); play('tap') }} className={`format-select-card ${activeFormat === format ? 'active' : ''}`}><span className="format-index">0{index + 1}</span><strong>{format}</strong><small>{Number(format[0]) * 2} fighters</small><span className="format-select-arrow">↗</span></button>)}</div></section>
    <section className="mode-section"><div className="section-title-row"><div><span className="eyebrow">CHOOSE YOUR PACE</span><h2>Four ways to <span>show up.</span></h2></div></div><div className="mode-card-grid">{modes.map((mode) => <button key={mode.id} className={`mode-card ${activeMode === mode.id ? 'active' : ''} mode-${mode.id}`} onClick={() => { setActiveMode(mode.id); if (mode.id === 'state') setShowStatePicker(true); play('tap') }}><span className="mode-card-icon">{mode.icon}</span><span className="mode-card-content"><strong>{mode.title}</strong><small>{mode.subtitle}</small><em>{mode.detail}</em></span><span className="mode-radio">{activeMode === mode.id ? '✓' : '＋'}</span></button>)}</div>{activeMode === 'state' && <div className="state-select-panel"><div className="state-badge"><Glyph>⌖</Glyph><div><small>REPRESENTING</small><strong>{selectedStateName}</strong></div></div><button className="button button-ghost" onClick={() => setShowStatePicker(!showStatePicker)}>{showStatePicker ? 'Close state picker' : 'Choose state'} <Glyph>⌄</Glyph></button>{showStatePicker && <label className="state-select-label">Choose your state<select value={stateChoice} onChange={(e) => { setStateChoice(e.target.value); setShowStatePicker(false); play('success') }}>{states.map((name) => <option key={name} value={stateCodes[name]}>{name}</option>)}</select></label>}<button className="button button-primary" onClick={() => enterBattle('state')}>Enter state battle <Glyph>↗</Glyph></button></div>}</section>
    <section className="battle-feed-section"><div className="section-title-row"><div><span className="eyebrow">THE ARENA RIGHT NOW</span><h2>Live <span>matchups.</span></h2></div><span className="feed-status"><span className="live-dot"/> {loadingRooms ? 'Syncing battles' : `${realRooms.length} live or waiting`}</span></div>{!isSupabaseConfigured && <div className="setup-notice"><Glyph>ⓘ</Glyph><div><strong>Connect your arena</strong><p>Live battles will appear here once Supabase is configured. No fake live rooms are shown in production mode.</p></div></div>}{isSupabaseConfigured && realRooms.length === 0 && <div className="empty-state"><span className="empty-icon">⌁</span><strong>The arena is warming up.</strong><p>No active rooms yet. Start a battle to open the first matchup.</p><button className="button button-primary" onClick={() => enterBattle(activeMode)}>Start a battle <Glyph>↗</Glyph></button></div>}{realRooms.length > 0 && <div className="live-room-grid">{realRooms.map((room) => <article className="live-room-card" key={room.id}><div className="room-card-top"><span className="live-tag"><span className="live-dot"/> {room.status === 'live' ? 'LIVE NOW' : 'WAITING'}</span><span className="room-format">{room.format} · {String(room.mode || 'standard').toUpperCase()}</span></div><div className="room-vs-row"><div className="room-team team-blue"><span>A</span><strong>TEAM ALPHA</strong><small>{room.mode === 'state' ? `State ${room.teamAState || '—'}` : 'Creator team'}</small></div><div className="room-score"><strong>{room.team_a_score || 0}</strong><small>VS</small><strong>{room.team_b_score || 0}</strong></div><div className="room-team team-purple"><span>B</span><strong>TEAM BETA</strong><small>{room.mode === 'state' ? `State ${room.teamBState || '—'}` : 'Creator team'}</small></div></div><div className="room-card-bottom"><span><Glyph>◉</Glyph> {room.viewer_count || 0} watching</span><button className="button button-small button-ghost" onClick={() => enterBattle(room.mode || activeMode, room.format, room.id)}>{room.status === 'live' ? 'Watch live' : 'Join battle'} <Glyph>↗</Glyph></button></div></article>)}</div>}</section>
    <section className="state-feature"><div className="state-feature-symbol">⌖</div><div><span className="eyebrow">HOME TURF, GLOBAL STAGE</span><h2>Bring your state <span>into the fight.</span></h2><p>Choose your state, put it above your profile, and show the arena where you rep.</p></div><button className="button button-ghost" onClick={() => { setActiveMode('state'); setStateBattles(true); setShowStatePicker(true); play('tap') }}>{stateBattles ? `Your state: ${stateChoice}` : 'Choose your state'} <Glyph>↗</Glyph></button></section>
  </div>
}

function BattleDirectory({ enterBattle, activeMode }: { enterBattle: (mode: BattleMode, format?: BattleFormat, existingBattleId?: string) => void; activeMode: BattleMode }) {
  const [rooms, setRooms] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [message, setMessage] = useState('')
  const loadRooms = useCallback(async (offset = 0) => {
    if (!supabase) return
    setMessage('')
    try {
      const { data, count, error } = await supabase.from('battles').select('id,format,mode,status,team_a_score,team_b_score,viewer_count,state_code,created_at', { count: 'exact' }).eq('is_test', false).in('status', ['waiting', 'live']).order('created_at', { ascending: false }).range(offset, offset + 49)
      if (error) throw error
      const ids = (data || []).map((room: any) => room.id)
      const { data: participants, error: participantError } = ids.length
        ? await supabase.from('battle_participants').select('battle_id,team,state_code').in('battle_id', ids).in('status', ['ready', 'active'])
        : { data: [], error: null }
      if (participantError) throw participantError
      const summaries = new Map<string, { a: string[]; b: string[] }>()
      for (const participant of participants || []) {
        if (!participant.state_code) continue
        const summary = summaries.get(participant.battle_id) || { a: [], b: [] }
        const side = participant.team === 'A' ? summary.a : summary.b
        if (!side.includes(participant.state_code)) side.push(participant.state_code)
        summaries.set(participant.battle_id, summary)
      }
      const nextRooms = (data || []).map((room: any) => {
        const summary = summaries.get(room.id)
        return { ...room, teamAState: summary?.a.join(' · ') || null, teamBState: summary?.b.join(' · ') || null }
      })
      setRooms((current) => offset === 0 ? nextRooms : [...current, ...nextRooms])
      setTotal(count || 0)
    } catch (error) {
      console.error('[Battle directory] Could not refresh open battle rooms', error)
      setMessage(`Could not load the battle directory: ${error instanceof Error ? error.message : 'Unexpected request failure'}`)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const db = supabase
    if (!db) return
    let active = true
    queueMicrotask(() => { if (active) void loadRooms(0) })
    const channel = db.channel('battle-directory-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => { void loadRooms(0) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants' }, () => { void loadRooms(0) })
      .subscribe()
    return () => { active = false; void db.removeChannel(channel) }
  }, [loadRooms])
  if (!isSupabaseConfigured) return <section className="battle-directory"><div className="section-title-row"><div><span className="eyebrow">OPEN ROOMS</span><h2>Battle <span>directory.</span></h2></div></div><div className="setup-notice"><Glyph>ⓘ</Glyph><div><strong>Connect your arena</strong><p>Open battle rooms will appear here once Supabase is configured.</p></div></div></section>
  return <section className="battle-directory"><div className="section-title-row"><div><span className="eyebrow">OPEN ROOMS</span><h2>Battle <span>directory.</span></h2></div><span className="feed-status">{loading ? 'Refreshing rooms' : `${total} open room${total === 1 ? '' : 's'}`}</span></div>
    {message && <div className="inline-message" role="alert">{message}</div>}
    {!loading && rooms.length === 0 && !message && <div className="empty-state"><span className="empty-icon">⌁</span><strong>No open battles right now.</strong><p>Live and waiting battles will show up here.</p></div>}
    {rooms.length > 0 && <div className="live-room-grid">{rooms.map((room) => <article className="live-room-card" key={room.id}><div className="room-card-top"><span className="live-tag"><span className="live-dot"/> {room.status === 'live' ? 'LIVE NOW' : 'WAITING'}</span><span className="room-format">{room.format} · {String(room.mode || 'standard').toUpperCase()}</span></div><div className="room-vs-row"><div className="room-team team-blue"><span>A</span><strong>TEAM ALPHA</strong><small>{room.mode === 'state' ? `State ${room.teamAState || '—'}` : 'Creator team'}</small></div><div className="room-score"><strong>{room.team_a_score || 0}</strong><small>VS</small><strong>{room.team_b_score || 0}</strong></div><div className="room-team team-purple"><span>B</span><strong>TEAM BETA</strong><small>{room.mode === 'state' ? `State ${room.teamBState || '—'}` : 'Creator team'}</small></div></div><div className="room-card-bottom"><span><Glyph>◉</Glyph> {room.viewer_count || 0} watching</span><button className="button button-small button-ghost" onClick={() => enterBattle(room.mode || activeMode, room.format, room.id)}>{room.status === 'live' ? 'Watch live' : 'Join battle'} <Glyph>↗</Glyph></button></div></article>)}</div>}
    {rooms.length < total && <button className="button button-ghost directory-load-more" disabled={loading} onClick={() => { setLoading(true); void loadRooms(rooms.length) }}>{loading ? 'Loading rooms…' : 'Load more battles'}</button>}
  </section>
}

function BattlesPage({ activeFormat, setActiveFormat, activeMode, setActiveMode, enterBattle, play }: { activeFormat: BattleFormat; setActiveFormat: (format: BattleFormat) => void; activeMode: BattleMode; setActiveMode: (mode: BattleMode) => void; enterBattle: (mode: BattleMode, format?: BattleFormat, existingBattleId?: string) => void; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  return <div className="page-stack"><section className="page-heading"><span className="eyebrow">BATTLE CONTROL</span><h1>Choose your <span>format.</span></h1><p>Pick your lineup and battle tempo before you enter the arena.</p></section><div className="format-large-grid">{formats.map((format, index) => <button key={format} className={`format-large-card ${activeFormat === format ? 'active' : ''}`} onClick={() => { setActiveFormat(format); play('tap') }}><span className="format-index">FORMAT 0{index + 1}</span><strong>{format}</strong><span className="format-fighters">{Number(format[0])} vs {Number(format[0])} · {Number(format[0]) * 2} total</span><span className="format-large-bottom"><small>{activeFormat === format ? 'Selected format' : 'Select format'}</small><Glyph>{activeFormat === format ? '✓' : '↗'}</Glyph></span></button>)}</div><section className="mode-section"><div className="section-title-row"><div><span className="eyebrow">BATTLE TEMPO</span><h2>Choose a <span>mode.</span></h2></div></div><div className="mode-card-grid">{modes.map((mode) => <button key={mode.id} className={`mode-card ${activeMode === mode.id ? 'active' : ''} mode-${mode.id}`} onClick={() => { setActiveMode(mode.id); play('tap') }}><span className="mode-card-icon">{mode.icon}</span><span className="mode-card-content"><strong>{mode.title}</strong><small>{mode.subtitle}</small><em>{mode.detail}</em></span><span className="mode-radio">{activeMode === mode.id ? '✓' : '＋'}</span></button>)}</div></section><div className="battle-launch-card"><div><span className="eyebrow">YOUR LOADOUT</span><h2>{activeFormat} <span>{modes.find((mode) => mode.id === activeMode)?.title}</span></h2><p>{activeMode === 'fast' ? '90 seconds of real-time intensity.' : activeMode === 'slow' ? 'Six minutes of strategy with a three-minute displayed clock.' : activeMode === 'state' ? 'Your selected state will appear at the top of your battle identity.' : 'A straight three-minute round. No rematches. No sudden death.'}</p></div><button className="button button-primary" onClick={() => enterBattle(activeMode, activeFormat)}><Glyph>⚔</Glyph> Enter arena <Glyph>↗</Glyph></button></div><BattleDirectory enterBattle={enterBattle} activeMode={activeMode} /></div>
}

function BattlePage({ profile, play }: { profile: UserProfile; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  }, [play])
  const { battleId = '' } = useParams(); const location = useLocation(); const navigate = useNavigate(); const query = new URLSearchParams(location.search); const format = (formats.includes(query.get('format') as BattleFormat) ? query.get('format') : '1v1') as BattleFormat; const mode = (['standard', 'fast', 'slow', 'state'].includes(query.get('mode') || '') ? query.get('mode') : 'standard') as BattleMode; const state = query.get('state') || profile.state_code || 'TX';
  const [remaining, setRemaining] = useState(180); const [battleStatus, setBattleStatus] = useState('waiting'); const [isTestBattle, setIsTestBattle] = useState(query.get('test') === '1'); const [testGiftMessage, setTestGiftMessage] = useState(''); const [teamScores, setTeamScores] = useState({ a: 0, b: 0 }); const [resultMessage, setResultMessage] = useState(''); const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting'); const [connectionMessage, setConnectionMessage] = useState('Connecting to GetStream…'); const [rtc, setRtc] = useState<StreamConnection | null>(null); const [rtcUiMounted, setRtcUiMounted] = useState(false); const [teamAssignments, setTeamAssignments] = useState<Record<string, { team: 'A' | 'B'; stateCode: string | null; name: string; status: string; avatarUrl: string | null }>>({}); const [selfParticipantStatus, setSelfParticipantStatus] = useState(''); const [autoQueue, setAutoQueue] = useState(true); const [showGiftPanel, setShowGiftPanel] = useState(false); const [shareOpen, setShareOpen] = useState(true); const [giftBusy, setGiftBusy] = useState(false); const [giftMessage, setGiftMessage] = useState(''); const [chatMessage, setChatMessage] = useState(''); const [chatError, setChatError] = useState(''); const [chatSending, setChatSending] = useState(false); const [chatRestrictedUntil, setChatRestrictedUntil] = useState<number | null>(null); const [messages, setMessages] = useState<{ id: string; name: string; text: string; createdAt: string }[]>([]); const chatMessagesRef = useRef<HTMLDivElement>(null); const [micOn, setMicOn] = useState(true); const [cameraOn, setCameraOn] = useState(true); const [leaving, setLeaving] = useState(false)
  const displayRate = mode === 'fast' ? 2 : mode === 'slow' ? 0.5 : 1
  const participantsPerTeam = Number(format[0]); const selectedStateName = states.find((name) => stateCodes[name] === state) || state
  const fmt = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const loadBattleParticipants = useCallback(async () => {
    const db = supabase
    if (!db) return
    const { data } = await db.from('battle_participants').select('user_profile_id,team,state_code,status,user_profiles(display_name,username,avatar_url)').eq('battle_id', battleId).in('status', ['ready','active','removed','completed'])
    const next: Record<string, { team: 'A' | 'B'; stateCode: string | null; name: string; status: string; avatarUrl: string | null }> = {}
    for (const row of data || []) {
      const user = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles
      next[row.user_profile_id] = { team: row.team as 'A' | 'B', stateCode: row.state_code, name: user?.display_name || user?.username || 'Fighter', status: row.status, avatarUrl: user?.avatar_url || null }; if (row.user_profile_id === profile.id) setSelfParticipantStatus(row.status)
    }
    setTeamAssignments(next)
  }, [battleId, profile.id])
  useEffect(() => {
    const db = supabase
    if (!db) return
    const initialLoad = window.setTimeout(() => void loadBattleParticipants(), 0)
    const channel = db.channel(`battle-participants-${battleId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` }, () => { void loadBattleParticipants() }).subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void db.removeChannel(channel)
    }
  }, [battleId, loadBattleParticipants])
  const loadChatMessages = useCallback(async () => {
    const db = supabase
    if (!db) return
    const { data, error } = await db.from('battle_chat_messages').select('id,body,created_at,user_profiles(display_name,username)').eq('battle_id', battleId).order('created_at', { ascending: false }).limit(60)
    if (error) return
    setMessages((data || []).reverse().map((row: any) => ({ id: row.id, name: Array.isArray(row.user_profiles) ? row.user_profiles[0]?.display_name || row.user_profiles[0]?.username || 'Fighter' : row.user_profiles?.display_name || row.user_profiles?.username || 'Fighter', text: row.body, createdAt: row.created_at })))
  }, [battleId])
  useEffect(() => {
    const chatList = chatMessagesRef.current
    if (chatList) chatList.scrollTo({ top: chatList.scrollHeight, behavior: 'smooth' })
  }, [messages])
  useEffect(() => {
    const db = supabase
    if (!db) return
    const initialLoad = window.setTimeout(() => void loadChatMessages(), 0)
    const channel = db.channel(`battle-chat-${battleId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_chat_messages', filter: `battle_id=eq.${battleId}` }, () => { void loadChatMessages() }).subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void db.removeChannel(channel)
    }
  }, [battleId, loadChatMessages])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let connection: StreamConnection | null = null
    async function connect() {
      try {
        const result = await connectGetStreamBattle(battleId, profile.id, profile.display_name, controller.signal)
        if (cancelled) {
          await result.dispose()
          return
        }
        connection = result
        setRtc(result)
        setRtcUiMounted(true)
        setConnectionMessage('Joined the secure RTC call. Preparing your camera and microphone…')
        void result.ready.then(() => {
          if (cancelled) return
          setConnectionState('connected')
          setConnectionMessage('Secure RTC connection established')
          playRef.current('success')
        }).catch((error: unknown) => {
          if (cancelled) return
          setRtcUiMounted(false)
          setConnectionState('error')
          setConnectionMessage(error instanceof Error ? error.message : 'Unable to prepare the GetStream call.')
        })
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        setConnectionState('error')
        setConnectionMessage(error instanceof Error ? error.message : 'Unable to connect to GetStream.')
      }
    }
    void connect()
    return () => {
      cancelled = true
      controller.abort()
      if (connection) void connection.dispose().catch((error: unknown) => console.error('[GetStream] Battle cleanup failed', error))
    }
  }, [battleId, profile.id, profile.display_name])
  useEffect(() => {
    if (!isTestBattle || !rtc) return
    let cancelled = false
    const controller = new AbortController()
    let opponent: Awaited<ReturnType<typeof connectTestBattleOpponent>> | null = null
    void connectTestBattleOpponent(battleId, controller.signal).then((connection) => {
      if (cancelled) {
        void connection.dispose().catch((error: unknown) => console.error('[Test battle] Opponent cleanup failed', error))
        return
      }
      opponent = connection
    }).catch((error: unknown) => {
      if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
      console.error('[Test battle] Admin Tester connection failed', error)
      setTestGiftMessage(error instanceof Error ? error.message : 'Admin Tester could not join the test call.')
    })
    return () => {
      cancelled = true
      controller.abort()
      if (opponent) void opponent.dispose().catch((error: unknown) => console.error('[Test battle] Opponent cleanup failed', error))
    }
  }, [isTestBattle, battleId, rtc])
  useEffect(() => {
    const db = supabase
    if (!db) return
    let alive = true
    let finalizeRequested = false
    const refreshBattle = async () => {
      const { data, error } = await db.from('battles').select('status,is_test,started_at,scheduled_end_at,clock_rate,team_a_score,team_b_score,winner_team,result_reason').eq('id', battleId).maybeSingle()
      if (!alive || error || !data) return
      setBattleStatus(data.status)
      setIsTestBattle(Boolean(data.is_test))
      setTeamScores({ a: Number(data.team_a_score || 0), b: Number(data.team_b_score || 0) })
      if (['completed','forfeit','moderation_ended','cancelled'].includes(data.status)) {
        setConnectionState('ended')
        setResultMessage(data.winner_team ? (data.winner_team === 'tie' ? 'The battle ended in a tie.' : `Team ${data.winner_team} won the battle.`) : 'The battle has closed.')
        return
      }
      if (data.status !== 'live' || !data.started_at) { setRemaining(180); return }
      const elapsed = Math.max(0, (Date.now() - new Date(data.started_at).getTime()) / 1000)
      const next = Math.max(0, Math.ceil(180 - elapsed * Number(data.clock_rate || displayRate)))
      setRemaining(next)
      if (next <= 0 && !finalizeRequested) {
        finalizeRequested = true
        const { error: finalizeError } = await db.functions.invoke('finalize-battle', { body: { battleId } })
        if (finalizeError && alive) finalizeRequested = false
        if (!finalizeError && alive) playRef.current('success')
      }
    }
    void refreshBattle()
    const timer = window.setInterval(() => void refreshBattle(), 1000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [battleId, displayRate])
  useEffect(() => {
    if (!isTestBattle || battleStatus !== 'live' || !supabase) return
    let cancelled = false
    let timer = 0
    const sendRandomGift = async () => {
      const giftKey = ['pulse', 'boost', 'crown'][Math.floor(Math.random() * 3)]
      const { data, error } = await supabase!.functions.invoke('test-bot-gift', { body: { battleId, giftKey } })
      if (cancelled) return
      if (error || data?.error) {
        console.error('[Test battle] Random bot gift failed', error || data.error)
        setTestGiftMessage(error?.message || data?.error || 'The test bot could not send a gift.')
      } else {
        setTestGiftMessage(`${data.senderName} sent ${data.giftName} · ${data.fakeBullets} fake Bullets · +${data.battlePoints} points`)
      }
      timer = window.setTimeout(() => void sendRandomGift(), 12000 + Math.floor(Math.random() * 21000))
    }
    timer = window.setTimeout(() => void sendRandomGift(), 8000 + Math.floor(Math.random() * 10000))
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [isTestBattle, battleStatus, battleId])
  useEffect(() => {
    if (!isTestBattle || battleStatus !== 'live' || !supabase) return
    let cancelled = false
    let timer = 0
    const writeChat = async () => {
      const { error, data } = await supabase!.functions.invoke('test-bot-chat', { body: { battleId } })
      if (cancelled) return
      if (error || data?.error) console.error('[Test battle] Opponent chat failed', error || data.error)
      timer = window.setTimeout(() => void writeChat(), 18000 + Math.floor(Math.random() * 22000))
    }
    timer = window.setTimeout(() => void writeChat(), 9000 + Math.floor(Math.random() * 9000))
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [isTestBattle, battleStatus, battleId])
  const endBattle = () => {
    if (leaving) return
    setLeaving(true)
    if (supabase) {
      void supabase.functions.invoke('leave-battle', { body: { battleId } }).then(({ error }) => {
        if (error) console.error('[Battle] Server leave update failed', error)
      }).catch((error: unknown) => console.error('[Battle] Server leave request failed', error))
    }
    play('tap')
    navigate('/')
  }
  useEffect(() => {
    const terminal = ['completed','forfeit','moderation_ended','cancelled'].includes(battleStatus)
    const shouldReleaseRtc = terminal || selfParticipantStatus === 'removed' || connectionState === 'error'
    const timer = window.setTimeout(() => {
      if (shouldReleaseRtc && rtcUiMounted) setRtcUiMounted(false)
      if (selfParticipantStatus === 'removed') {
        setConnectionState('ended')
        setResultMessage('Your participation was ended by safety moderation. Review the Community Guidelines before returning to the arena.')
      }
    }, 0)
    if (shouldReleaseRtc && rtc && !rtcUiMounted) {
      void rtc.dispose().catch((error: unknown) => console.error('[GetStream] Battle cleanup failed', error))
    }
    return () => window.clearTimeout(timer)
  }, [battleStatus, selfParticipantStatus, connectionState, rtc, rtcUiMounted])
  useEffect(() => {
    if (isTestBattle || connectionState !== 'ended' || !autoQueue || rtc?.isViewer || selfParticipantStatus === 'removed' || !['completed','forfeit'].includes(battleStatus)) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!supabase) return
      setResultMessage('Finding your next opponent…')
      const { data, error } = await supabase.functions.invoke('create-battle', { body: { format, mode, stateCode: state } })
      if (cancelled) return
      if (error || !data?.battleId) { setAutoQueue(false); setResultMessage(await battleRequestErrorMessage(error, data, 'The next battle could not be queued. Return to the arena to try again.')); return }
      navigate(`/battle/${data.battleId}?format=${data.format || format}&mode=${data.mode || mode}&state=${data.stateCode || state}`)
    }, 4200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [connectionState, autoQueue, rtc, selfParticipantStatus, battleStatus, format, mode, state, navigate, isTestBattle])
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const text = chatMessage.trim()
    if (!text || chatSending) return
    if (battleStatus !== 'live') { setChatError('Chat is available once the battle goes live.'); return }
    if (!supabase) { setChatError('Supabase is not configured.'); return }
    setChatError('')
    setChatSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-battle-chat', { body: { battleId, message: text, requestId: crypto.randomUUID() } })
      if (error || data?.error) {
        // Handle chat restriction with countdown
        if (data?.restrictedUntil && data?.sanction === 'chat_timeout') {
          const until = new Date(data.restrictedUntil).getTime()
          setChatRestrictedUntil(until)
          return
        }
        setChatError(error?.message || data.error)
        return
      }
      setChatMessage('')
      if (data?.blocked) {
        setChatError(data.notice || 'This message was blocked by the safety filter.')
      } else {
        await loadChatMessages()
      }
      play('tap')
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to send chat message.')
    } finally {
      setChatSending(false)
    }
  }

  // Countdown effect for chat restriction
  useEffect(() => {
    if (!chatRestrictedUntil) return
    const updateCountdown = () => {
      const now = Date.now()
      if (chatRestrictedUntil <= now) {
        setChatRestrictedUntil(null)
        setChatError('')
      } else {
        const seconds = Math.ceil((chatRestrictedUntil - now) / 1000)
        setChatError(`Chat is disabled for ${seconds}s. You can chat again soon.`)
      }
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [chatRestrictedUntil])
  const setDevice = async (device: 'mic' | 'camera') => { if (!rtc) return; try { if (device === 'mic') { if (micOn) await rtc.call.microphone.disable(); else await rtc.call.microphone.enable(); setMicOn(!micOn) } else { if (cameraOn) await rtc.call.camera.disable(); else await rtc.call.camera.enable(); setCameraOn(!cameraOn) } play('tap') } catch (error) { setConnectionMessage(error instanceof Error ? error.message : 'Could not change device state.') } }
  return <div className={`battle-page ${isTestBattle ? 'test-battle-page' : ''}`}><header className="battle-topbar"><button className="icon-button" onClick={() => void endBattle()} aria-label="Exit battle">←</button><Brand compact /><div className="battle-top-meta"><span className={`connection-indicator ${connectionState}`}><i/>{connectionState === 'connected' ? 'RTC CONNECTED' : connectionState === 'ended' ? 'ROUND COMPLETE' : connectionState === 'error' ? 'CONNECTION ISSUE' : 'CONNECTING'}</span><span className="battle-format-pill">{format} · {mode.toUpperCase()}</span></div></header><main className="battle-main">{isTestBattle && <div className="test-battle-notice"><strong>TEST BATTLE · REAL CAMERA</strong><span>Your GetStream camera and microphone are live. Bot gifts use fake, non-spendable Bullets and this match does not affect wallet balances, earnings, rankings, or cooldowns.</span></div>}<div className="battle-heading"><div><span className="eyebrow">{isTestBattle ? 'TEST MATCH · ' : 'LIVE BATTLE · '}{battleId.slice(0, 8).toUpperCase()}</span><h1>THE <span>ARENA.</span></h1>{mode === 'state' && <div className="state-banner"><Glyph>⌖</Glyph> REPRESENTING <strong>{selectedStateName}</strong></div>}</div><div className={`battle-timer ${remaining < 30 ? 'urgent' : ''}`}><small>TIME REMAINING</small><strong>{fmt(remaining)}</strong><span>{mode === 'fast' ? 'FAST · 3:00' : mode === 'slow' ? 'SLOW · 0.5× CLOCK' : 'STANDARD CLOCK'}</span></div></div><div className="battle-scorebar"><div className="score-team score-a"><span>TEAM A</span><strong>{String(teamScores.a).padStart(2, '0')}</strong></div><div className="score-center"><span>VS</span><small>{connectionState === 'ended' ? 'ROUND COMPLETE' : battleStatus === 'live' ? 'ROUND IN PROGRESS' : 'WAITING FOR OPPONENTS'}</small></div><div className="score-team score-b"><span>TEAM B</span><strong>{String(teamScores.b).padStart(2, '0')}</strong></div></div>
    <BattleAudience battleId={battleId} profile={profile} />
    <div className={`rtc-stage format-${format}`}>{rtc && rtcUiMounted
      ? <StreamRtcView client={rtc.client} call={rtc.call} teamAssignments={teamAssignments} format={format} participantsPerTeam={participantsPerTeam} mode={mode} ownProfileId={profile.id} ownStateCode={state} testMode={isTestBattle} />
      : <UniversalBattleArena teamAssignments={teamAssignments} format={format} participantsPerTeam={participantsPerTeam} mode={mode} ownProfileId={profile.id} ownStateCode={state} testMode={isTestBattle} />}</div>
    {connectionState === 'error' && <div className="rtc-error"><Glyph>ⓘ</Glyph><div><strong>RTC isn't connected yet</strong><p>{connectionMessage} Configure the GetStream API key and deploy the stream-token Edge Function. The screen remains available, but this is not a live broadcast until the SDK connects.</p></div></div>}{connectionState === 'connecting' && <div className="rtc-connecting"><span className="loading-spinner"/><span>{connectionMessage}</span></div>}{connectionState === 'connected' && battleStatus === 'waiting' && <div className="rtc-connecting waiting-opponents"><span className="live-dot"/><span>Your stream is connected. Waiting for the remaining fighters; the official timer starts when every required participant is connected.</span></div>}{connectionState === 'ended' && <div className="round-ended"><Glyph>✦</Glyph><div><strong>Round complete</strong><p>{resultMessage || 'The battle has ended. The official result was finalized by the server.'}</p></div>{autoQueue && !rtc?.isViewer && selfParticipantStatus !== 'removed' && <button className="button button-ghost" onClick={() => { setAutoQueue(false); setResultMessage('Auto queue stopped. You can return to the arena when ready.') }}>Stop auto queue</button>}<button className="button button-primary" onClick={() => { setAutoQueue(false); navigate('/') }}>Return to arena</button></div>}
    <div className="battle-controls"><button className={`control-button ${micOn ? '' : 'control-off'}`} onClick={() => void setDevice('mic')} disabled={!rtc || connectionState !== 'connected' || rtc.isViewer}><Glyph>{micOn ? '♬' : '×'}</Glyph><small>{rtc?.isViewer ? 'Viewer' : micOn ? 'Mic on' : 'Mic off'}</small></button><button className={`control-button ${cameraOn ? '' : 'control-off'}`} onClick={() => void setDevice('camera')} disabled={!rtc || connectionState !== 'connected' || rtc.isViewer}><Glyph>{cameraOn ? '▣' : '□'}</Glyph><small>{rtc?.isViewer ? 'Viewer' : cameraOn ? 'Camera on' : 'Camera off'}</small></button>{!isTestBattle && <button className={`control-button ${showGiftPanel ? 'control-active' : ''}`} onClick={() => setShowGiftPanel(!showGiftPanel)}><Glyph>✦</Glyph><small>Gifts</small></button>}<button className="control-button" onClick={() => document.getElementById('battle-chat')?.focus()}><Glyph>▤</Glyph><small>Chat</small></button><button className="control-button" onClick={() => setShareOpen(true)}><Glyph>↗</Glyph><small>Share</small></button><button className="control-button control-danger" onClick={() => void endBattle()}><Glyph>×</Glyph><small>Leave</small></button></div>
    {isTestBattle && testGiftMessage && <div className="test-bot-gift-toast" role="status">{testGiftMessage}</div>}
    {showGiftPanel && !isTestBattle && <div className="gift-panel"><div><strong>Battle gifts</strong><small>Static gifts · secure Bullet ledger</small></div>{[{ key: 'pulse', name: 'Pulse', icon: '✦', price: 10 }, { key: 'boost', name: 'Boost', icon: 'ϟ', price: 50 }, { key: 'crown', name: 'Crown', icon: '♛', price: 125 }, { key: 'nova', name: 'Nova', icon: '✧', price: 500 }].map((gift) => <button key={gift.name} disabled={giftBusy} onClick={async () => { if (!supabase) { setGiftMessage('Supabase is not configured.'); return } setGiftBusy(true); setGiftMessage(''); const {data,error}=await supabase.functions.invoke('send-battle-gift',{body:{battleId,giftKey:gift.key}}); setGiftBusy(false); if(error||data?.error) setGiftMessage(error?.message||data.error); else { setGiftMessage(`${gift.name} sent · ${gift.price} Bullets · +${data.battlePoints} points`); play('success') } }}><span>{gift.icon}</span><strong>{gift.name}</strong><small>{gift.price} Bullets</small></button>)}{giftMessage && <div className="gift-message">{giftMessage}</div>}</div>}
    <section className="battle-chat-panel"><div className="chat-heading"><div><span className="eyebrow">LIVE CHAT</span><strong>Keep it competitive.</strong></div><span className="chat-safety"><Glyph>♧</Glyph> MAI SAFETY ACTIVE </span></div><div className="chat-messages" ref={chatMessagesRef}>{messages.length === 0 ? <p className="chat-empty">{battleStatus === 'live' ? 'No messages yet. Keep it respectful and bring the energy.' : 'Chat opens when the battle goes live.'}</p> : messages.map((message) => <p key={message.id}><strong>{message.name}</strong> {message.text}</p>)}</div>{chatError && <div className="inline-message">{chatError}</div>}<form className="chat-form" onSubmit={sendMessage}><input id="battle-chat" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={battleStatus === 'live' ? 'Say something to the arena…' : 'Chat opens when the battle goes live…'} maxLength={240} disabled={battleStatus !== 'live' || chatSending} /><button type="submit" className="button button-primary button-small" disabled={battleStatus !== 'live' || chatSending || !chatMessage.trim()}>{chatSending ? 'Sending…' : 'Send ↗'}</button></form></section><p className="battle-disclaimer">Do not threaten, harass, or encourage self-harm. Report safety concerns. Promotional recording requires explicit consent from every participant.</p></main>{shareOpen && <BattleShareModal battleId={battleId} format={format} mode={mode} onClose={() => setShareOpen(false)} />}</div>
}

function TestBattleLauncher() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const start = async () => {
    if (!supabase || busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      const { data, error } = await supabase.functions.invoke('create-test-battle', { body: {} })
      if (error || !data?.battleId) throw new Error(error?.message || data?.error || 'Could not create the test battle.')
      navigate(`/battle/${data.battleId}?format=1v1&mode=standard&test=1`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create the test battle.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="test-battle-launcher">
    <Link className="inline-link" to="/">← Back to arena</Link>
    <span className="eyebrow">RTC AND GIFT FLOW TEST</span>
    <h1>Real camera.<br/><span>Safe test credits.</span></h1>
    <p>This opens a real GetStream 1v1 battle. Your camera and mic connect normally; Admin Tester appears as the opponent, and a separate bot sends randomly timed fake gifts. Test matches never spend or award real Bullets.</p>
    {errorMessage && <div className="inline-message" role="alert">{errorMessage}</div>}
    <button className="button button-primary" type="button" onClick={() => void start()} disabled={busy || !supabase}>{busy ? 'Creating test battle…' : 'Start real 1v1 test battle'} <Glyph>↗</Glyph></button>
    {!supabase && <small className="test-battle-setup-error">Supabase must be configured to start this test battle.</small>}
  </main>
}

function BattleShareModal({ battleId, format, mode, onClose }: { battleId: string; format: BattleFormat; mode: BattleMode; onClose: () => void }) {
  const [copyMessage, setCopyMessage] = useState('')
  const battleUrl = `${window.location.origin}/battle/${encodeURIComponent(battleId)}?format=${encodeURIComponent(format)}&mode=${encodeURIComponent(mode)}`
  const shareText = `I'm in a ${format} ${mode} battle on Mai Live Wars. Join the arena: ${battleUrl}`
  const encodedUrl = encodeURIComponent(battleUrl)
  const encodedText = encodeURIComponent(shareText)
  const platforms = [
    { name: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'X', url: `https://twitter.com/intent/tweet?text=${encodedText}` },
    { name: 'Threads', url: `https://www.threads.net/intent/post?text=${encodedText}` },
    { name: 'WhatsApp', url: `https://wa.me/?text=${encodedText}` },
    { name: 'Telegram', url: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`I'm in a ${format} ${mode} battle on Mai Live Wars. Join the arena!`)}` },
    { name: 'Reddit', url: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(`Join my ${format} Mai Live Wars battle`)}` },
    { name: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: 'TikTok', url: 'https://www.tiktok.com/upload', copyFirst: true },
    { name: 'Instagram', url: 'https://www.instagram.com/', copyFirst: true },
  ]
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopyMessage('Caption and battle link copied. Paste them into your post.')
    } catch (error) {
      console.error('[Battle share] Clipboard copy failed', error)
      setCopyMessage('Could not access the clipboard. Copy the link shown above instead.')
    }
  }

  async function openPlatform(platform: typeof platforms[number]) {
    if (platform.copyFirst) {
      window.open(platform.url, '_blank', 'noopener,noreferrer')
      await copyShareText()
      return
    }
    window.open(platform.url, '_blank', 'noopener,noreferrer')
  }

  return <div className="share-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <button className="share-modal-close" type="button" onClick={onClose} aria-label="Close share dialog">×</button>
      <span className="eyebrow">SPREAD THE WORD</span>
      <h2 id="share-modal-title">Share your battle</h2>
      <p>Choose a platform to open its share or post flow. If you’re not signed in there, sign in on that platform and continue creating your post.</p>
      <div className="share-link-preview">{battleUrl}</div>
      <button className="button button-primary share-copy-button" type="button" onClick={() => void copyShareText()}>Copy caption and battle link</button>
      {copyMessage && <p className="share-copy-status" role="status">{copyMessage}</p>}
      <div className="share-platform-grid">{platforms.map((platform) => <button className="share-platform-button" type="button" key={platform.name} onClick={() => void openPlatform(platform)}><strong>{platform.name}</strong><span>{platform.copyFirst ? 'Copy link · open post flow' : 'Open share composer'}</span></button>)}</div>
      <p className="share-platform-note">TikTok and Instagram require you to finish the post in their app or website. This share sheet does not sign in or publish for you.</p>
      <button className="button button-ghost share-done-button" type="button" onClick={onClose}>Done</button>
    </section>
  </div>
}

function StreamRtcView({ client, call, teamAssignments, format, participantsPerTeam, mode, ownProfileId, ownStateCode, testMode }: { client: StreamConnection['client']; call: StreamConnection['call']; teamAssignments: Record<string, { team: 'A' | 'B'; stateCode: string | null; name: string; status: string; avatarUrl: string | null }>; format: BattleFormat; participantsPerTeam: number; mode: BattleMode; ownProfileId: string; ownStateCode: string; testMode: boolean }) {
  return <StreamVideo client={client}><StreamCall call={call}><StreamParticipantGrid teamAssignments={teamAssignments} format={format} participantsPerTeam={participantsPerTeam} mode={mode} ownProfileId={ownProfileId} ownStateCode={ownStateCode} testMode={testMode} /></StreamCall></StreamVideo>
}
function StreamParticipantGrid({ teamAssignments, format, participantsPerTeam, mode, ownProfileId, ownStateCode, testMode }: { teamAssignments: Record<string, { team: 'A' | 'B'; stateCode: string | null; name: string; status: string; avatarUrl: string | null }>; format: BattleFormat; participantsPerTeam: number; mode: BattleMode; ownProfileId: string; ownStateCode: string; testMode: boolean }) {
  const hooks = useCallStateHooks()
  const participants = hooks.useParticipants()
  const remoteAudioParticipants = hooks.useRawParticipants().filter((participant) => !participant.isLocalParticipant)
  const byId = new Map<string, any>(participants.map((participant: any) => [participant.userId, participant]))
  return <><ParticipantsAudio participants={remoteAudioParticipants} /><UniversalBattleArena teamAssignments={teamAssignments} format={format} participantsPerTeam={participantsPerTeam} mode={mode} ownProfileId={ownProfileId} ownStateCode={ownStateCode} participantsByUserId={byId} testMode={testMode} /></>
}

function UniversalBattleArena({ teamAssignments, format, participantsPerTeam, mode, ownProfileId, ownStateCode, participantsByUserId = new Map(), testMode = false }: {
  teamAssignments: Record<string, { team: 'A' | 'B'; stateCode: string | null; name: string; status: string; avatarUrl?: string | null }>
  format: BattleFormat
  participantsPerTeam: number
  mode: BattleMode
  ownProfileId: string
  ownStateCode: string
  participantsByUserId?: Map<string, any>
  testMode?: boolean
}) {
  const makeTeam = (team: 'A' | 'B') => Array.from({ length: participantsPerTeam }, (_, index) => {
    const profileEntry = Object.entries(teamAssignments).filter(([, info]) => info.team === team && !['removed', 'left', 'forfeit'].includes(info.status))[index]
    const userId = profileEntry?.[0]
    const participant = userId ? participantsByUserId.get(userId) : null
    const info = userId ? teamAssignments[userId] : null
    const stateCode = mode === 'state' ? (info?.stateCode || (userId === ownProfileId ? ownStateCode : null)) : null
    const stateName = stateCode ? states.find((name) => stateCodes[name] === stateCode) || stateCode : null
    return testMode && info && userId !== ownProfileId
      ? createElement('div', { className: `sdk-participant-card test-profile-card tile-team-${team.toLowerCase()}`, key: participant?.sessionId || userId }, info.avatarUrl ? createElement('img', { className: 'test-profile-avatar', src: info.avatarUrl, alt: `${info.name} avatar` }) : createElement('span', { className: 'test-profile-avatar test-profile-avatar-fallback' }, info.name.slice(0, 1).toUpperCase()), createElement('span', { className: 'test-profile-status' }, participant ? 'ADMIN TESTER · CONNECTED' : 'ADMIN TESTER'), createElement('span', { className: 'sdk-participant-label' }, info.name))
      : participant
      ? createElement('div', { className: `sdk-participant-card tile-team-${team.toLowerCase()}`, key: participant.sessionId || userId }, createElement(ParticipantView as any, { participant, muteAudio: true, className: 'sdk-participant-video' }), stateName && createElement('span', { className: 'sdk-participant-state' }, `⌖ ${stateName}`), createElement('span', { className: 'sdk-participant-label' }, info?.name || participant.name || 'Fighter'))
      : createElement('div', { className: `sdk-participant-card sdk-placeholder tile-team-${team.toLowerCase()}`, key: userId || `empty-${team}-${index}` }, stateName && createElement('span', { className: 'sdk-participant-state' }, `⌖ ${stateName}`), createElement('span', { className: 'sdk-placeholder-initial' }, info?.name?.slice(0, 1).toUpperCase() || '＋'), createElement('span', { className: 'sdk-participant-label' }, info?.name || `Fighter ${index + 1} · Waiting`))
  })
  return <BattleArenaLayout participantsPerTeam={participantsPerTeam} format={format} makeTeam={makeTeam} />
}

function BulletStore({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [message, setMessage] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [packages, setPackages] = useState<any[]>([
    { key: 'starter-125', name: 'Starter Pack', bullets: 125, price: 1 },
    { key: 'battle-500', name: 'Battle Starter', bullets: 500, price: 4 },
    { key: 'creator-1250', name: 'Creator Boost', bullets: 1250, price: 10 },
    { key: 'arena-2500', name: 'Arena Pack', bullets: 2500, price: 20 },
    { key: 'vault-6500', name: 'Arena Vault', bullets: 6500, price: 52 },
    { key: 'executive-31500', name: 'Executive Pack', bullets: 31500, price: 2500, locked: true },
  ])
  useEffect(() => { let alive = true; const db = supabase; if (!db) return; void db.from('bullet_packages').select('package_key,display_name,bullets,price_usd,requires_admin_confirmation').eq('active', true).order('bullets', { ascending: true }).then(({ data, error }) => { if (!alive || error || !data) return; const activePackages = data.map((pkg: any) => ({ key: pkg.package_key, name: pkg.display_name, bullets: Number(pkg.bullets), price: Number(pkg.price_usd), locked: Boolean(pkg.requires_admin_confirmation) })); if (!activePackages.some((pkg: any) => pkg.key === 'executive-31500')) activePackages.push({ key: 'executive-31500', name: 'Executive Pack', bullets: 31500, price: 2500, locked: true }); setPackages(activePackages) }); return () => { alive = false } }, [])
  async function buy(packageKey: string) {
    setMessage('')
    if (!supabase) { setMessage('Supabase is not configured.'); return }
    setBusyKey(packageKey)
    const { data, error } = await supabase.functions.invoke('paypal-create-order', { body: { packageKey } })
    setBusyKey('')
    if (error || data?.error) { setMessage(data?.error || error?.message || 'Unable to open PayPal checkout.'); return }
    const approval = data?.links?.find((link: any) => link.rel === 'approve' || link.rel === 'payer-action')
    if (!approval?.href) { setMessage('PayPal did not return an approval URL.'); return }
    sessionStorage.setItem('mai_life_wars_pending_paypal_order', data.orderId)
    sessionStorage.setItem('mai_life_wars_pending_paypal_purchase', data.purchaseId)
    window.location.assign(approval.href)
    play('tap')
  }
  return <><div className="bullet-store-grid">{packages.map((pkg) => <article className="bullet-store-card" key={pkg.key}><span className="store-bullet-icon">●</span><div><strong>{pkg.bullets.toLocaleString()}</strong><small>Bullets</small>{(pkg as any).locked && <em className="store-locked-note">Awaiting price confirmation</em>}</div><button className="button button-ghost button-small" disabled={busyKey === pkg.key || Boolean((pkg as any).locked)} onClick={() => void buy(pkg.key)}>{(pkg as any).locked ? 'Price review' : busyKey === pkg.key ? 'Opening…' : `$${pkg.price.toFixed(2)}`}</button></article>)}</div><small className="muted-note">Digital currency purchase methods are subject to Apple and Google billing rules. Packages are enabled server-side only after payment setup is approved.</small>{message && <div className="inline-message">{message}</div>}</>
}

function PayPalReturnPage({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const playRef = useRef(play)
  useEffect(() => {
    playRef.current = play
  }, [play])
  const [message, setMessage] = useState('Confirming your PayPal payment…')
  const [busy, setBusy] = useState(true)
  const navigate = useNavigate()
  useEffect(() => { let alive = true; async function capture() { const orderId = new URLSearchParams(window.location.search).get('token') || sessionStorage.getItem('mai_life_wars_pending_paypal_order'); if (!orderId || !supabase) { if (alive) { setMessage('No pending PayPal order was found.'); setBusy(false) } return } const { data, error } = await supabase.functions.invoke('paypal-capture-order', { body: { orderId } }); if (!alive) return; if (error || data?.error) setMessage(error?.message || data.error); else { sessionStorage.removeItem('mai_life_wars_pending_paypal_order'); sessionStorage.removeItem('mai_life_wars_pending_paypal_purchase'); setMessage(`${Number(data.bullets || 0).toLocaleString()} Bullets were credited to your wallet.`); playRef.current('success') } setBusy(false) } void capture(); return () => { alive = false } }, [])
  return <div className="center-page"><Brand /><div className="auth-box reset-box"><span className="eyebrow">PAYPAL CHECKOUT</span><h2>{busy ? 'Confirming payment' : 'Payment status'}</h2><p>{message}</p><button className="button button-primary button-full" disabled={busy} onClick={() => navigate('/profile')}>Return to wallet ↗</button></div><PublicFooter /></div>
}

function RankingsPage({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [period, setPeriod] = useState<'weekly' | 'all-time'>('weekly')
  useEffect(() => { let alive = true; async function load() { if (!supabase) { setLoading(false); return } const { data, error } = await supabase.from('battle_ratings').select('rating, wins, losses, user_profile_id, user_profiles(username,display_name,avatar_url,state_code)').order('rating', { ascending: false }).limit(50); if (alive) { if (!error && data) setRows(data); setLoading(false) } } void load(); return () => { alive = false } }, [])
  return <div className="page-stack"><section className="page-heading rankings-heading"><div><span className="eyebrow">THE LEADERBOARD</span><h1>Earn your <span>place.</span></h1><p>Rank is built on competition, not just spending.</p></div><div className="ranking-emblem">♜<small>MAI<br/>RANK</small></div></section><div className="ranking-tabs"><button className={period === 'weekly' ? 'active' : ''} onClick={() => { setPeriod('weekly'); play('tap') }}>This week</button><button className={period === 'all-time' ? 'active' : ''} onClick={() => { setPeriod('all-time'); play('tap') }}>All-time</button></div>{!supabase && <div className="setup-notice"><Glyph>ⓘ</Glyph><div><strong>Rankings are waiting for data</strong><p>Connect Supabase and record verified battle results to populate the leaderboard.</p></div></div>}{loading ? <LoadingScreen /> : rows.length === 0 && supabase ? <div className="empty-state"><span className="empty-icon">♜</span><strong>The leaderboard is yours to write.</strong><p>Finish battles to earn your first verified ranking.</p></div> : <div className="leaderboard-table">{rows.map((row, index) => { const user = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles; return <div className={`leaderboard-row ${index < 3 ? `top-${index + 1}` : ''}`} key={row.user_profile_id}><span className="leader-rank">{String(index + 1).padStart(2, '0')}</span><span className="leader-avatar">{user?.display_name?.slice(0, 1) || '?'}</span><div className="leader-user"><strong>{user?.display_name || 'Fighter'}</strong><small>@{user?.username || 'unknown'} {user?.state_code ? `· ${user.state_code}` : ''}</small></div><div className="leader-stat"><strong>{row.wins || 0}</strong><small>WINS</small></div><div className="leader-rating"><strong>{row.rating || 1000}</strong><small>RATING</small></div><span className="leader-medal">{index === 0 ? '✦' : index === 1 ? '✧' : index === 2 ? '◇' : '—'}</span></div> })}</div>}<p className="ranking-note">Leaderboard standings are based on verified battle results and the active rating rules. Gift spending alone does not determine skill rating.</p></div>
}

function ProfilePage({ profile, session, onRefresh, play, onSignOut }: { profile: UserProfile; session: Session; onRefresh: () => Promise<unknown>; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void; onSignOut: () => Promise<void> }) {
  const currentDate = useCurrentDate()
  const [wallet, setWallet] = useState<any>(null); const [cashoutHistory, setCashoutHistory] = useState<any[]>([]); const [recordingConsent, setRecordingConsent] = useState(profile.marketing_recording_consent); const [paypalEmail, setPaypalEmail] = useState(''); const [recipientVerified, setRecipientVerified] = useState(false); const [cashoutAmount, setCashoutAmount] = useState('3750'); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [showDelete, setShowDelete] = useState(false); const [deleteConfirm, setDeleteConfirm] = useState('')
  useEffect(() => { let alive = true; if (!supabase) return; void Promise.all([supabase.rpc('get_my_profile_bullet_balances').maybeSingle(),supabase.from('payout_recipients').select('paypal_email,verified').eq('user_profile_id',profile.id).maybeSingle(),supabase.from('cashout_requests').select('id,amount_bullets,amount_usd,status,scheduled_processing_date,created_at').eq('user_profile_id',profile.id).order('created_at',{ascending:false}).limit(8)]).then(([walletResult,recipientResult,cashoutResult]) => { if (alive) { setWallet(walletResult.data); setRecordingConsent(profile.marketing_recording_consent); setPaypalEmail(recipientResult.data?.paypal_email || ''); setRecipientVerified(Boolean(recipientResult.data?.verified)); setCashoutHistory(cashoutResult.data || []) } }); return () => { alive = false } }, [profile.id, profile.marketing_recording_consent])
  async function updateRecordingConsent(nextConsent: boolean) { if (!supabase) return setMessage('Supabase is not configured.'); setBusy(true); const {data,error}=await supabase.functions.invoke('update-recording-consent',{body:{consent:nextConsent}}); setBusy(false); if(error||data?.error) setMessage(error?.message||data.error); else { setRecordingConsent(nextConsent); setMessage(nextConsent?'Marketing recording consent enabled for future eligible recordings.':'Marketing recording consent withdrawn for future recordings.'); play('success') } }
  async function savePaypalRecipient() { setMessage(''); if (!supabase) return setMessage('Supabase is not configured.'); setBusy(true); const {data,error}=await supabase.functions.invoke('save-payout-recipient',{body:{paypalEmail}}); setBusy(false); if(error||data?.error) setMessage(error?.message||data.error); else { setRecipientVerified(false); setMessage(data.message || 'PayPal payout destination saved and awaits verification.'); play('success') } }
  async function requestCashout() {
    setMessage('')
    if (!supabase) return setMessage('Supabase is not configured.')
    if (!recipientVerified) return setMessage('Save your PayPal email and wait for payout destination verification before requesting a cashout.')
    const amount = Number(cashoutAmount)
    if (!Number.isInteger(amount) || amount < 3750) return setMessage('Cashouts require at least 3,750 eligible earnings Bullets.')
    const storageKey = `cashout-request:${profile.id}:${amount}`
    const idempotencyKey = window.sessionStorage.getItem(storageKey) || crypto.randomUUID()
    window.sessionStorage.setItem(storageKey, idempotencyKey)
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('request-cashout', { body: { amountBullets: amount, idempotencyKey } })
    setBusy(false)
    if (error || data?.error) {
      setMessage(error?.message || data.error)
      return
    }
    window.sessionStorage.removeItem(storageKey)
    setMessage('Cashout request submitted. Check the cashout history for its current status.')
    const [walletResult, historyResult] = await Promise.all([
      supabase.rpc('get_my_profile_bullet_balances').maybeSingle(),
      supabase.from('cashout_requests').select('id,amount_bullets,amount_usd,status,scheduled_processing_date,created_at').eq('user_profile_id', profile.id).order('created_at', { ascending: false }).limit(8),
    ])
    setWallet(walletResult.data)
    setCashoutHistory(historyResult.data || [])
    play('success')
  }
  async function deleteAccount() { if (deleteConfirm !== 'DELETE') { setMessage('Type DELETE to confirm account deletion.'); return } if (!supabase) return setMessage('Supabase is not configured.'); setBusy(true); const { error } = await supabase.functions.invoke('request-account-deletion', { body: { confirmation: 'DELETE' } }); setBusy(false); if (error) setMessage(error.message); else { await onSignOut(); setMessage('Account deletion request submitted.') } }
  const centralWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Chicago' }).format(currentDate); const nowDay = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[centralWeekday] ?? currentDate.getDay(); const nextCashout = nowDay === 1 || nowDay === 5 ? 'Today (processing window)' : nowDay === 0 || nowDay === 6 ? 'Monday' : 'Friday'
  return <div className="page-stack"><section className="page-heading"><span className="eyebrow">YOUR FIGHTER ID</span><h1>Your <span>profile.</span></h1><p>Manage your public identity, Bullets, consent, and account.</p></section><section className="profile-hero-card"><div className="profile-avatar-large">{profile.display_name.slice(0, 1).toUpperCase()}<span className="profile-online-dot"/></div><div className="profile-hero-info"><span className="profile-state-pill"><Glyph>⌖</Glyph> {profile.state_code || 'STATE NOT SET'}</span><h2>{profile.display_name}</h2><p>@{profile.username}</p><small>{profile.city ? `${profile.city}${profile.state_code ? `, ${profile.state_code}` : ''}` : 'Add your city in profile settings'}</small></div><div className="profile-rank-badge"><span>FIGHTER</span><strong>01</strong><small>MEMBER</small></div></section><div className="profile-grid"><section className="profile-panel"><div className="section-title-row"><div><span className="eyebrow">BULLET WALLET</span><h2>Your <span>balance.</span></h2></div><span className="wallet-lock">⌑ SECURE</span></div><div className="wallet-balance-grid"><div><small>Spendable Bullets</small><strong>{Number(wallet?.spendable_bullets || 0).toLocaleString()}</strong><span>For eligible gifts</span></div><div><small>Cashable Bullets</small><strong>{Number(wallet?.cashable_bullets || 0).toLocaleString()}</strong><span>Withdrawable balance</span></div></div><div className="wallet-policy"><div><span>Base purchase rate</span><strong>125 Bullets / $1</strong></div><div><span>Minimum cashout</span><strong>3,750 eligible Bullets</strong></div><div><span>Next processing day</span><strong>{nextCashout}</strong></div></div><div className="cashout-tiers"><span className="eyebrow">CASHOUT TIERS</span><div className="cashout-tier-grid">{(function(){const tiers=[];const min=3750;const max=15000000;const count=10;for(let i=0;i<count;i++){const t=Math.exp(Math.log(min)+(Math.log(max)-Math.log(min))*i/(count-1));tiers.push(Math.round(t/100)*100)}return [...new Set(tiers)].map((bullets)=>(<div key={bullets} className="cashout-tier-card"><strong>{bullets.toLocaleString()} Bullets</strong><span>= ${(bullets/350).toFixed(2)}</span><small>{bullets===3750?'Minimum':bullets===15000000?'Max':'Custom amount allowed'}</small></div>))})()}</div><p className="cashout-formula">Rate: 350 eligible Bullets = $1 · Processed Mon/Fri · Any amount ≥ 3,750 Bullets</p></div><label>PayPal payout email<input type="email" value={paypalEmail} onChange={(e) => { setPaypalEmail(e.target.value); setRecipientVerified(false) }} placeholder="payments@example.com" required /></label><button className="button button-ghost button-full" onClick={() => void savePaypalRecipient()} disabled={busy}>Save PayPal email · {recipientVerified ? 'verified' : 'verification required'}</button><small className="muted-note">{recipientVerified ? 'Your payout destination has been reviewed.' : 'Payouts remain disabled until an administrator verifies this destination.'}</small><label>Cashout amount in eligible Bullets<input type="number" min="3750" step="1" value={cashoutAmount} onChange={(e) => setCashoutAmount(e.target.value)} /></label><button className="button button-primary button-full" onClick={() => void requestCashout()} disabled={busy}>{busy ? 'Submitting…' : 'Request PayPal cashout'} <Glyph>↗</Glyph></button>{message && <div className="inline-message">{message}</div>}<small className="muted-note">Cashout requests are processed Monday and Friday, subject to eligibility, verification, and PayPal availability. This request does not guarantee immediate payment.</small><div className="cashout-history"><div className="section-title-row"><div><span className="eyebrow">PAYOUT ACTIVITY</span><h2>Cashout <span>history.</span></h2></div></div>{cashoutHistory.length===0?<small className="muted-note">Your cashout requests will appear here.</small>:cashoutHistory.map((item)=><div className="cashout-history-row" key={item.id}><div><strong>${Number(item.amount_usd).toFixed(2)}</strong><small>{Number(item.amount_bullets).toLocaleString()} eligible Bullets · {new Date(item.created_at).toLocaleDateString()}</small></div><span className={`status-tag ${item.status==='paid'?'':'warning'}`}>{item.status}</span></div>)}</div></section><section className="profile-panel"><div className="section-title-row"><div><span className="eyebrow">BULLET STORE</span><h2>Fuel your <span>next round.</span></h2></div></div>{isNativeApp ? <div className="pc-store-notice"><p>Bullet purchases are available on the PC web version, not in the mobile app.</p><a className="button button-ghost button-full" href={import.meta.env.VITE_PUBLIC_APP_URL || 'https://mai-live-batttles.onrender.com'} target="_blank" rel="noreferrer">Open PC store <Glyph>↗</Glyph></a></div> : <BulletStore play={play} />}<div className="section-title-row" style={{marginTop:24}}><div><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Keep it <span>yours.</span></h2></div></div><div className="settings-row"><div><strong>Marketing recording consent</strong><small>{recordingConsent ? 'You opted in. Promotional recording is still disabled unless every participant in a specific battle has opted in.' : 'You have not opted in. Promotional recording is disabled for you.'}</small></div><button className={`button button-small ${recordingConsent?'button-ghost':'button-primary'}`} disabled={busy} onClick={() => void updateRecordingConsent(!recordingConsent)}>{recordingConsent?'Withdraw':'Opt in'}</button></div><div className="settings-row"><div><strong>Account email</strong><small>{session.user.email}</small></div><span className="settings-secure">SECURE</span></div><div className="settings-row"><div><strong>App role</strong><small>Only User and Admin roles exist.</small></div><span className="settings-secure">{profile.role.toUpperCase()}</span></div><div className="settings-row"><div><strong>Privacy & consent</strong><small>Read the current policies and recording notice.</small></div><Link to="/privacy" className="inline-link">Review ↗</Link></div><div className="profile-action-buttons"><button className="button button-ghost" onClick={() => void onRefresh().then(() => play('success'))}>Refresh profile</button><button className="button button-ghost" onClick={() => void onSignOut()}>Sign out</button></div><div className="danger-zone"><div><strong>Delete account</strong><small>Request permanent account deletion. Some legally required financial records may be retained.</small></div><button className="button button-danger" onClick={() => setShowDelete(!showDelete)}>Delete account</button>{showDelete && <div className="delete-confirm"><p>This action cannot be undone. Type DELETE to confirm.</p><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE" /><button className="button button-danger button-full" disabled={busy} onClick={() => void deleteAccount()}>{busy ? 'Submitting request…' : 'Confirm account deletion'}</button></div>}</div></section></div><div className="profile-legal-links"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/community-guidelines">Community Guidelines</Link><Link to="/safety">Safety</Link></div></div>
}

function AdminDashboard({ profile, play }: { profile: UserProfile | null; play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const currentDate = useCurrentDate()
  const [section, setSection] = useState<'overview' | 'battles' | 'moderation' | 'cashouts' | 'economy' | 'users' | 'settings'>('overview'); const [metrics, setMetrics] = useState({ users: 0, live: 0, cashouts: 0, flags: 0 }); const [cashouts, setCashouts] = useState<any[]>([]); const [flags, setFlags] = useState<any[]>([]); const [busyId, setBusyId] = useState(''); const [message, setMessage] = useState(''); const [serviceHealth, setServiceHealth] = useState<Record<string, boolean> | null>(null)
  useEffect(() => { let alive = true; async function load() { if (!supabase) return; const [users, battles, payout, moderation, health] = await Promise.all([supabase.from('user_profiles').select('id', { count: 'exact', head: true }), supabase.from('battles').select('id', { count: 'exact', head: true }).eq('status', 'live'), supabase.from('cashout_requests').select('*').in('status', ['pending', 'approved', 'processing']).order('created_at', { ascending: true }).limit(100), supabase.from('moderation_events').select('*').order('created_at', { ascending: false }).limit(50), supabase.functions.invoke('admin-system-health')]); if (!alive) return; setMetrics({ users: users.count || 0, live: battles.count || 0, cashouts: payout.data?.length || 0, flags: moderation.data?.length || 0 }); setCashouts(payout.data || []); setFlags(moderation.data || []); if (!health.error && health.data) setServiceHealth(health.data) } void load(); return () => { alive = false } }, [])
  async function processCashout(id: string, action: 'approve' | 'reject') { if (!supabase) return; setBusyId(id); setMessage(''); const { data, error } = await supabase.functions.invoke('admin-cashout-review', { body: { cashoutRequestId: id, action } }); setBusyId(''); if (error || data?.error) setMessage(error?.message || data.error); else { setCashouts((rows) => rows.map((row) => row.id === id ? { ...row, status: action === 'approve' ? 'approved' : 'rejected' } : row)); setMessage(`Cashout ${action} action recorded.`); play('success') } }
  async function terminateBattle(id: string) { if (!supabase || !window.confirm('Terminate this battle? This action will be audited.')) return; setBusyId(id); const { data, error } = await supabase.functions.invoke('admin-terminate-battle', { body: { battleId: id, reason: 'Admin safety intervention' } }); setBusyId(''); setMessage(error?.message || data?.error || 'Termination request sent. Verify the battle status in the database.'); play('warning') }
  return <div className="admin-page"><header className="admin-topbar"><Brand compact /><div className="admin-access-label"><span className="admin-shield">▦</span><div><strong>CONTROL ROOM</strong><small>Authenticated administrator · {profile?.username}</small></div></div>{profile && <InAppNotifications profileId={profile.id} />}<Link className="button button-ghost button-small" to="/">Exit dashboard ↗</Link></header><div className="admin-layout"><aside className="admin-sidebar"><span className="eyebrow">ADMINISTRATION</span>{([{ id: 'overview', label: 'Overview', icon: '▦' }, { id: 'battles', label: 'Live battles', icon: '⚔' }, { id: 'moderation', label: 'AI moderation', icon: '♧' }, { id: 'cashouts', label: 'Cashout requests', icon: '◈' }, { id: 'economy', label: 'Bullets & gifts', icon: '●' }, { id: 'users', label: 'User accounts', icon: '◉' }, { id: 'settings', label: 'Configuration', icon: '⚙' }] as const).map((item) => <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); play('tap') }}><Glyph>{item.icon}</Glyph>{item.label}{item.id === 'cashouts' && metrics.cashouts > 0 && <small>{metrics.cashouts}</small>}</button>)}<div className="admin-sidebar-bottom"><span className="live-dot"/>SECURE SESSION<br/><small>Role-based route gate active</small></div></aside><main className="admin-main"><div className="admin-heading"><div><span className="eyebrow">MAI CORP · OPERATIONS</span><h1>{({ overview: 'Command center', battles: 'Live battles', moderation: 'AI moderation', cashouts: 'Cashout queue', economy: 'Bullets & gifts', users: 'User accounts', settings: 'System configuration' } as const)[section]}</h1><p>Protect the arena. Keep every transaction accountable.</p></div><span className="admin-date">{currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>{message && <div className="inline-message">{message}</div>}
    {section === 'overview' && <><div className="admin-metric-grid">{[{ label: 'Registered users', value: metrics.users.toLocaleString(), icon: '◉', trend: 'Supabase profiles' }, { label: 'Live battles', value: metrics.live.toLocaleString(), icon: '⚔', trend: 'Currently active' }, { label: 'Pending cashouts', value: metrics.cashouts.toLocaleString(), icon: '◈', trend: 'Needs review' }, { label: 'Moderation events', value: metrics.flags.toLocaleString(), icon: '♧', trend: 'Recent events' }].map((metric) => <article className="admin-metric-card" key={metric.label}><span className="admin-metric-icon">{metric.icon}</span><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.trend}</span></article>)}</div><div className="admin-overview-grid"><section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Cashout queue</h2></div><button className="inline-link" onClick={() => setSection('cashouts')}>Review all ↗</button></div>{cashouts.slice(0, 5).length === 0 ? <div className="admin-empty">No pending cashouts returned by the database.</div> : cashouts.slice(0, 5).map((row) => <div className="admin-list-row" key={row.id}><div><strong>{Number(row.amount_bullets || 0).toLocaleString()} Bullets</strong><small>{row.status} · {new Date(row.created_at).toLocaleDateString()}</small></div><span className="status-tag">{row.status}</span></div>)}</section><section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">SAFETY SIGNALS</span><h2>Recent moderation</h2></div><button className="inline-link" onClick={() => setSection('moderation')}>Review all ↗</button></div>{flags.slice(0, 5).length === 0 ? <div className="admin-empty">No recent moderation events returned.</div> : flags.slice(0, 5).map((row) => <div className="admin-list-row" key={row.id}><div><strong>{row.category || 'Moderation event'}</strong><small>{row.enforcement_action || 'Review required'} · {new Date(row.created_at).toLocaleString()}</small></div><span className="status-tag warning">{row.review_status || 'logged'}</span></div>)}</section></div></>}
    {section === 'battles' && <section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">SERVER-REPORTED SESSIONS</span><h2>Active battles</h2></div><button className="button button-ghost button-small" onClick={() => window.location.reload()}>Refresh ↻</button></div><p className="admin-explainer">Battle controls only operate through protected server functions. Do not change scores or finalize outcomes from this dashboard directly.</p><AdminBattles onTerminate={terminateBattle} busyId={busyId} /></section>}
    {section === 'moderation' && <section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">AI-ASSISTED SAFETY</span><h2>Moderation events</h2></div><span className="status-tag">{flags.length} events</span></div>{flags.length === 0 ? <div className="admin-empty">No moderation events are currently available. Confirm the moderation Edge Function is deployed and writing events.</div> : flags.map((row) => <article className="moderation-admin-row" key={row.id}><div className="moderation-category-icon">♧</div><div className="moderation-admin-content"><strong>{row.category || 'Uncategorized event'}</strong><p>{row.summary || 'Sensitive content details are restricted. Review the event securely.'}</p><small>Battle {String(row.battle_id || '').slice(0, 8)} · confidence {row.confidence ?? 'n/a'} · {new Date(row.created_at).toLocaleString()}</small></div><span className={`status-tag ${row.enforcement_action ? 'warning' : ''}`}>{row.enforcement_action || 'review'}</span></article>)}</section>}
    {section === 'cashouts' && <section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">PAYPAL PAYOUTS</span><h2>Creator cashout requests</h2></div><span className="status-tag warning">{cashouts.filter((row) => row.status === 'pending').length} pending</span></div><p className="admin-explainer">Approving a request authorizes the server to validate eligibility and prepare a PayPal payout. Payment status must be reconciled from PayPal webhooks.</p>{cashouts.length === 0 ? <div className="admin-empty">No cashout requests were returned by Supabase.</div> : cashouts.map((row) => <article className="cashout-admin-row" key={row.id}><div><strong>{Number(row.amount_bullets || 0).toLocaleString()} eligible Bullets</strong><small>Request {row.id.slice(0, 8)} · {new Date(row.created_at).toLocaleString()}</small><span className="status-tag">{row.status}</span></div><div className="cashout-actions"><button className="button button-ghost button-small" disabled={busyId === row.id || row.status !== 'pending'} onClick={() => void processCashout(row.id, 'reject')}>Reject</button><button className="button button-primary button-small" disabled={busyId === row.id || row.status !== 'pending'} onClick={() => void processCashout(row.id, 'approve')}>{busyId === row.id ? 'Working…' : 'Approve'}</button>{row.status === 'approved' && <button className="button button-ghost button-small" disabled={busyId === row.id} onClick={async () => { if (!supabase) return; setBusyId(row.id); const {data,error}=await supabase.functions.invoke('paypal-payout',{body:{cashoutRequestId:row.id}}); setBusyId(''); setMessage(error?.message||data?.error||'Payout submitted for processing.'); if (!error && !data?.error) setCashouts((items)=>items.map((item)=>item.id===row.id?{...item,status:'processing'}:item)) }}>Send payout</button>}</div></article>)}</section>}
    {section === 'economy' && <AdminEconomy play={play} />}
    {section === 'users' && <section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">ACCOUNT DIRECTORY</span><h2>User profiles</h2></div></div><p className="admin-explainer">This dashboard uses the public user_profiles table as the application identity source. Only two roles exist: user and admin. Review payout destination evidence before marking an email verified.</p><AdminUsers /><AdminPayoutRecipients /><AdminDeletionRequests /></section>}
    {section === 'settings' && <section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">SYSTEM SETTINGS</span><h2>Production configuration</h2></div></div><div className="config-check-list">{[{ label: 'Supabase client', ok: isSupabaseConfigured, hint: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY' }, { label: 'GetStream API key', ok: Boolean(import.meta.env.VITE_GETSTREAM_API_KEY), hint: 'Public app key only; secret stays in Edge Function secrets' }, { label: 'Public hosting URL', ok: Boolean(import.meta.env.VITE_PUBLIC_APP_URL), hint: 'Required for canonical SEO URLs; custom domain not required' }, { label: 'OpenRouter moderation secret', ok: Boolean(serviceHealth?.openrouter), hint: 'Server-only OpenRouter key and moderation model for AI safety' }, { label: 'PayPal integration', ok: Boolean(serviceHealth?.paypal), hint: 'PayPal live credentials and webhook ID are present; webhook signature validation is still required' }, { label: 'GetStream server credentials', ok: Boolean(serviceHealth?.getstream), hint: 'GetStream API key and secret are configured server-side' }, { label: 'Server callback URL', ok: Boolean(serviceHealth?.publicUrl), hint: 'Required for PayPal return URLs and canonical SEO sitemap' }].map((item) => <div className="config-check" key={item.label}><span className={`config-check-icon ${item.ok ? 'good' : 'pending'}`}>{item.ok ? '✓' : '!'}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div><span className={`status-tag ${item.ok ? '' : 'warning'}`}>{item.ok ? 'configured' : 'needs setup'}</span></div>)}</div><div className="security-callout"><Glyph>♧</Glyph><div><strong>Never add server secrets to VITE_ variables.</strong><p>Supabase service-role key, GetStream API secret, OpenRouter API key, and PayPal secret must be stored as Supabase Edge Function secrets.</p></div></div></section>}
    </main></div><footer className="admin-footer">© {CURRENT_YEAR} MAI Corp. All rights reserved. <span>ADMIN ACCESS IS AUDITED</span></footer></div>
}

function AdminBattles({ onTerminate, busyId }: { onTerminate: (id: string) => void; busyId: string }) { const [rows, setRows] = useState<any[]>([]); useEffect(() => { if (!supabase) return; void supabase.from('battles').select('id,format,mode,status,started_at,state_code').eq('status', 'live').order('started_at', { ascending: false }).limit(100).then(({ data }) => setRows(data || [])) }, []); return rows.length === 0 ? <div className="admin-empty">No active battle rows were returned.</div> : <div>{rows.map((row) => <div className="cashout-admin-row" key={row.id}><div><strong>{row.format} · {row.mode}</strong><small>Battle {row.id.slice(0, 8)} · State {row.state_code || '—'} · started {row.started_at ? new Date(row.started_at).toLocaleTimeString() : 'unknown'}</small></div><button className="button button-danger button-small" disabled={busyId === row.id} onClick={() => onTerminate(row.id)}>{busyId === row.id ? 'Working…' : 'Terminate'}</button></div>)}</div> }
function AdminUsers() {
  const [rows, setRows] = useState<Array<{
    id: string
    username: string
    display_name: string
    role: string
    created_at: string
    state_code: string | null
    spendable_bullets: number
    cashable_bullets: number
  }>>([])
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      async function load() {
        if (!supabase) return
        const { data, error: profilesError } = await supabase.functions.invoke('admin-list-users', { body: {} })
        if (profilesError || data?.error) {
          console.error('[Admin] Could not load user profiles', profilesError || data.error)
          if (alive) setLoadError('Could not load user profiles.')
          return
        }
        if (!alive) return
        setRows(data?.profiles || [])
        setLoadError('')
      }

      void load()
    }, 0)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [])

  const filtered = rows.filter((row) => `${row.username} ${row.display_name}`.toLowerCase().includes(search.toLowerCase()))

  return <>
    <input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loaded profiles…" />
    {loadError && <div className="inline-message" role="alert">{loadError}</div>}
    <div className="admin-user-list">
      <div className="admin-users-header" aria-hidden="true">
        <span>Profile</span><span>Spendable</span><span>Cashable</span><span>Role</span>
      </div>
      {filtered.map((row) => <div className="admin-users-row" key={row.id}>
        <div className="admin-users-profile">
          <strong>{row.display_name} <small>@{row.username}</small></strong>
          <small>{row.state_code || 'No state'} · {new Date(row.created_at).toLocaleDateString()}</small>
        </div>
        <strong className="admin-users-bullets">{row.spendable_bullets.toLocaleString()}</strong>
        <strong className="admin-users-bullets">{row.cashable_bullets.toLocaleString()}</strong>
        <span className="status-tag">{row.role}</span>
      </div>)}
    </div>
  </>
}



function AdminEconomy({ play }: { play: (kind?: 'tap' | 'success' | 'battle' | 'warning') => void }) {
  const [packages,setPackages]=useState<any[]>([]); const [gifts,setGifts]=useState<any[]>([]); const [message,setMessage]=useState(''); const [busy,setBusy]=useState('')
  const load=async()=>{const db=supabase;if(!db)return;const [packageResult,giftResult]=await Promise.all([db.from('bullet_packages').select('*').order('bullets',{ascending:true}),db.from('gift_catalog').select('*').order('sort_order',{ascending:true})]);setPackages(packageResult.data||[]);setGifts(giftResult.data||[])}
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[])
  async function setPackage(pkg:any,active:boolean,confirmPricing=false){if(!supabase)return;if(pkg.requires_admin_confirmation&&active&&!confirmPricing)return;setBusy(pkg.id);setMessage('');const {data,error}=await supabase.functions.invoke('admin-update-package',{body:{packageId:pkg.id,active,confirmPricing}});setBusy('');if(error||data?.error)setMessage(error?.message||data.error);else{setMessage(`${pkg.display_name} updated.`);await load();play('success')}}
  return <div className="economy-admin-stack"><section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">VIRTUAL CURRENCY</span><h2>Bullet packages</h2></div><span className="status-tag">125 purchased Bullets / $1</span></div><p className="admin-explainer">The standard packages use the 125 Bullets per dollar rate. The 31,500-Bullet package is intentionally locked because its listed $2,500 price conflicts with the base conversion. Confirm the pricing deliberately before activating it.</p>{message&&<div className="inline-message">{message}</div>}{packages.map((pkg)=> <div className="economy-row" key={pkg.id}><div className="economy-package-icon">●</div><div className="economy-row-copy"><strong>{pkg.display_name}</strong><small>{Number(pkg.bullets).toLocaleString()} Bullets · ${Number(pkg.price_usd).toFixed(2)}</small>{pkg.requires_admin_confirmation&&<small className="economy-warning">Requires explicit pricing confirmation</small>}</div><span className={`status-tag ${pkg.active?'':'warning'}`}>{pkg.active?'active':'disabled'}</span>{pkg.requires_admin_confirmation?<button className="button button-ghost button-small" disabled={busy===pkg.id||pkg.active} onClick={()=>{if(window.confirm('Confirm activation of 31,500 Bullets for $2,500 even though this conflicts with the 125 Bullets per $1 base conversion?'))void setPackage(pkg,true,true)}}>{busy===pkg.id?'Saving…':'Confirm price'}</button>:<button className={`button ${pkg.active?'button-ghost':'button-primary'} button-small`} disabled={busy===pkg.id} onClick={()=>void setPackage(pkg,!pkg.active)}>{busy===pkg.id?'Saving…':pkg.active?'Disable':'Enable'}</button>}</div>)}</section><section className="admin-content-card"><div className="admin-card-heading"><div><span className="eyebrow">STATIC GIFTS</span><h2>Battle gift catalog</h2></div><span className="status-tag">No animations</span></div>{gifts.map((gift)=><div className="economy-row" key={gift.id}><div className="economy-package-icon">{gift.icon_key==='bolt'?'ϟ':gift.icon_key==='crown'?'♛':gift.icon_key==='star'?'✧':'✦'}</div><div className="economy-row-copy"><strong>{gift.display_name}</strong><small>{gift.bullet_cost} Bullets · {gift.battle_points} battle points</small></div><span className={`status-tag ${gift.active?'':'warning'}`}>{gift.active?'active':'disabled'}</span></div>)}</section></div>
}


function AdminDeletionRequests() {
  const [rows,setRows]=useState<any[]>([]); const [message,setMessage]=useState(''); const [busy,setBusy]=useState('')
  const load=async()=>{if(!supabase)return;const {data}=await supabase.from('account_deletion_requests').select('id,user_profile_id,status,requested_at').in('status',['requested','processing']).order('requested_at',{ascending:true}).limit(100);setRows(data||[])}
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[])
  async function process(id:string){if(!supabase)return;if(!window.confirm('Complete this deletion request? The profile will be anonymized and the associated Auth account deleted. Required financial/audit records may remain.'))return;setBusy(id);const {data,error}=await supabase.functions.invoke('admin-process-account-deletion',{body:{requestId:id,action:'complete'}});setBusy('');setMessage(error?.message||data?.error||(data?.status==='completed'?'Account deletion completed.':'Deletion status updated.'));if(!error&&!data?.error)await load()}
  return <section className="admin-content-card admin-sub-card"><div className="admin-card-heading"><div><span className="eyebrow">PRIVACY OPERATIONS</span><h2>Account deletion requests</h2></div><span className="status-tag warning">{rows.length} open</span></div>{message&&<div className="inline-message">{message}</div>}{rows.length===0?<div className="admin-empty">No open account deletion requests.</div>:rows.map((row)=><div className="admin-list-row" key={row.id}><div><strong>Profile {row.user_profile_id.slice(0,8)}</strong><small>Requested {new Date(row.requested_at).toLocaleString()} · {row.status}</small></div><button className="button button-danger button-small" disabled={busy===row.id} onClick={()=>void process(row.id)}>{busy===row.id?'Processing…':'Complete deletion'}</button></div>)}</section>
}

function AdminPayoutRecipients() {
  const [rows,setRows]=useState<any[]>([]); const [message,setMessage]=useState(''); const [busy,setBusy]=useState('')
  const load=async()=>{if(!supabase)return;const {data}=await supabase.from('payout_recipients').select('user_profile_id,paypal_email,verified,updated_at,user_profiles(username,display_name)').order('updated_at',{ascending:false}).limit(100);setRows(data||[])}
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[])
  async function verify(id:string,verified:boolean){if(!supabase)return;setBusy(id);const {data,error}=await supabase.functions.invoke('admin-verify-payout-recipient',{body:{userProfileId:id,verified}});setBusy('');setMessage(error?.message||data?.error||(verified?'Recipient marked reviewed and verified.':'Recipient verification removed.'));if(!error&&!data?.error)setRows((current)=>current.map((row)=>row.user_profile_id===id?{...row,verified}:row))}
  return <section className="admin-content-card admin-sub-card"><div className="admin-card-heading"><div><span className="eyebrow">PAYMENT DESTINATIONS</span><h2>PayPal recipient review</h2></div><span className="status-tag">{rows.filter((row)=>row.verified).length} verified</span></div>{message&&<div className="inline-message">{message}</div>}{rows.length===0?<div className="admin-empty">No PayPal payout destinations have been submitted.</div>:rows.map((row)=>{const user=Array.isArray(row.user_profiles)?row.user_profiles[0]:row.user_profiles;return <div className="admin-list-row" key={row.user_profile_id}><div><strong>{user?.display_name||user?.username||'Creator'}</strong><small>{row.paypal_email} · {row.verified?'verified':'needs review'}</small></div><button className={`button ${row.verified?'button-ghost':'button-primary'} button-small`} disabled={busy===row.user_profile_id} onClick={()=>void verify(row.user_profile_id,!row.verified)}>{busy===row.user_profile_id?'Saving…':row.verified?'Revoke':'Mark verified'}</button></div>})}</section>
}

function PublicInfoPage({ page }: { page: PublicPage }) { const copy = pageCopy[page]; const location = useLocation(); useEffect(() => { setPageMeta(copy.title, copy.description, location.pathname) }, [copy, location.pathname]); return <div className="public-shell info-shell"><PublicHeader /><main className="info-main"><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title.split(' ').slice(0, -1).join(' ')} <span>{copy.title.split(' ').slice(-1)}</span></h1><p className="info-lede">{copy.description}</p><div className="info-content">{copy.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div><div className="info-actions"><Link to="/auth" className="button button-primary">Enter the arena <Glyph>↗</Glyph></Link><Link to="/" className="button button-ghost">Back home</Link></div></main><PublicFooter /></div> }
function AccessDenied() { return <div className="center-page"><Brand /><div className="auth-box"><span className="eyebrow">ROUTE GATED</span><h2>Admin access required.</h2><p>This route is restricted to accounts with the server-verified <strong>admin</strong> role. Your account has not been granted that role.</p><Link to="/" className="button button-primary button-full">Return to the arena</Link></div><PublicFooter /></div> }
function LoadingScreen() { return <div className="loading-screen"><span className="loading-spinner"/><p>Loading secure account data…</p></div> }
function NotFound() { return <div className="center-page"><Brand /><div className="auth-box"><span className="eyebrow">404 · LOST IN THE ARENA</span><h2>This route doesn't exist.</h2><p>Head back to the arena and find your next matchup.</p><Link className="button button-primary button-full" to="/">Back to home ↗</Link></div><PublicFooter /></div> }

export default function RootApp() { return <App /> }
