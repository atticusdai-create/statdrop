import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function JoinTeam() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp } = useAuth()
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [team, setTeam] = useState(null)
  const [playerName, setPlayerName] = useState('')
  const [position, setPosition] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Landing page passes team data in location state to skip the code step
    const preloaded = location.state?.team
    if (preloaded) {
      setTeam(preloaded)
      setStep(2)
    }
  }, [])

  async function handleFindTeam(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setError('Enter an invite code.'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase
      .from('teams')
      .select('id, name')
      .eq('invite_code', trimmed)
      .single()

    setLoading(false)
    if (err || !data) { setError("That code doesn't match any team. Check it and try again."); return }
    setTeam(data)
    setStep(2)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!playerName.trim()) { setError('Enter your name.'); return }
    if (!position) { setError('Select your position.'); return }
    if (jerseyNumber === '' || jerseyNumber === null) { setError('Enter your jersey number.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')

    const { data: authData, error: authErr } = await signUp(email.trim(), password)
    if (authErr) { setError(authErr.message); setLoading(false); return }

    if (!authData.session) {
      // Email confirmation required — player row will be created after they confirm and log in
      setLoading(false)
      setDone(true)
      return
    }

    // Session is established: use the confirmed session's user ID to guarantee
    // the auth.users row exists before we reference it via FK
    const userId = authData.session.user.id

    const { data: playerData, error: playerErr } = await supabase
      .from('players')
      .insert([{
        name: playerName.trim(),
        position: position,
        jersey_number: parseInt(jerseyNumber, 10),
        team_id: team.id,
        user_id: userId,
      }])
      .select('id')
      .single()

    setLoading(false)
    if (playerErr) { setError(playerErr.message); return }

    navigate(`/player/${playerData.id}`)
  }

  const headingStyle = {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(36px, 7vw, 52px)',
    fontWeight: 800, lineHeight: 0.95,
    letterSpacing: '-0.02em', textTransform: 'uppercase',
    color: 'var(--text)', margin: '0 0 40px',
  }

  const eyebrowStyle = {
    fontFamily: 'var(--font-display)',
    fontSize: '12px', fontWeight: 600,
    letterSpacing: '0.2em', textTransform: 'uppercase',
    color: 'var(--accent)', marginBottom: '12px',
  }

  if (done) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px',
          fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
          letterSpacing: '-0.02em', marginBottom: '16px',
        }}>Done.</div>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6 }}>
          You&apos;re on the roster! Check your inbox to confirm your email, then{' '}
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: 'none',
              color: 'var(--accent)', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'inherit', padding: 0,
            }}
          >
            log in
          </button>
          {' '}to view your stats.
        </p>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px' }}>
        <p style={eyebrowStyle}>Join a team</p>
        <h1 style={headingStyle}>Find<br />Your Team</h1>

        <form onSubmit={handleFindTeam} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label" htmlFor="invite-code">Invite code</label>
            <input
              id="invite-code"
              className="field"
              type="text"
              placeholder="e.g. X4K9PQ"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
              autoComplete="off"
              required
            />
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Ask your coach or team captain for the 6-character code.
            </p>
          </div>

          {error && (
            <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Looking up…' : 'Find Team'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px' }}>
      <button
        onClick={() => { setStep(1); setError('') }}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '32px',
        }}
      >
        ← Back
      </button>

      <p style={eyebrowStyle}>Basketball</p>
      <h1 style={headingStyle}>{team.name}</h1>

      <div style={{
        background: 'var(--ground)', borderRadius: '10px',
        padding: '14px 18px', marginBottom: '32px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '18px' }}>✓</span>
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
          Team found — create your account to join the roster.
        </span>
      </div>

      <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="label" htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            className="field"
            type="text"
            placeholder="e.g. Marcus Johnson"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="position">Position</label>
          <select
            id="position"
            className="field"
            value={position}
            onChange={e => setPosition(e.target.value)}
            required
          >
            <option value="" disabled>Select a position</option>
            <option value="Point Guard">Point Guard</option>
            <option value="Shooting Guard">Shooting Guard</option>
            <option value="Small Forward">Small Forward</option>
            <option value="Power Forward">Power Forward</option>
            <option value="Center">Center</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="jersey-number">Jersey number</label>
          <input
            id="jersey-number"
            className="field"
            type="number"
            min="0"
            max="99"
            placeholder="e.g. 23"
            value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            required
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: '16px',
          }}>
            Create your account
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="field"
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>

        {error && (
          <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating account…' : `Join ${team.name}`}
        </button>
      </form>
    </div>
  )
}
