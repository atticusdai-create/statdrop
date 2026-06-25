import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const TICKER_ITEMS = [
  { player: 'J. Rivera', stat: '31 PTS' },
  { player: 'T. Okafor', stat: '12 AST' },
  { player: 'A. Davis',  stat: '8 BLK' },
  { player: 'K. Nwosu',  stat: '6 STL' },
  { player: 'S. Patel',  stat: '24 PTS' },
  { player: 'D. Yılmaz', stat: '11 AST' },
  { player: 'L. Torres', stat: '14 REB' },
]

const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]

export default function Landing() {
  const { user, playerProfile } = useAuth()
  const navigate = useNavigate()

  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    if (!user || playerProfile === undefined) return
    if (playerProfile) navigate(`/player/${playerProfile.id}`, { replace: true })
    else navigate('/dashboard', { replace: true })
  }, [user, playerProfile, navigate])

  async function handleFindTeam(e) {
    e.preventDefault()
    const trimmed = joinCode.trim().toUpperCase()
    if (!trimmed) { setJoinError('Enter an invite code.'); return }
    setJoinLoading(true)
    setJoinError('')
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .eq('invite_code', trimmed)
      .single()
    setJoinLoading(false)
    if (error || !data) { setJoinError("That code doesn't match any team. Check it and try again."); return }
    // Hand off to the dedicated join page for name + account creation
    navigate('/join', { state: { team: data } })
  }

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Hero */}
      <section style={{
        minHeight: 'calc(100svh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        padding: '60px 24px 40px',
      }}>
        {/* Big background type — the aesthetic risk */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(160px, 28vw, 340px)',
          lineHeight: 0.85,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: 'transparent',
          WebkitTextStroke: '1.5px rgba(26,92,255,0.10)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          STAT<br />DROP
        </div>

        {/* Foreground content */}
        <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '24px',
          }}>
            Team Stats, Simplified
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(48px, 9vw, 88px)',
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: 'var(--text)',
            margin: '0 0 28px',
          }}>
            Every game.<br />
            Every number.<br />
            <span style={{ color: 'var(--accent)' }}>One place.</span>
          </h1>

          <p style={{
            fontSize: '17px',
            color: 'var(--muted)',
            lineHeight: 1.65,
            maxWidth: '460px',
            margin: '0 auto 40px',
          }}>
            Log stats after every game. Track player progress over time. See who's leading the team — sorted however you need.
          </p>

          <div className="hero-ctas" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/create" className="btn-primary">
              Create a Team
            </Link>
            <Link to="/join" className="btn-ghost">
              Join a Team
            </Link>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
        padding: '14px 0',
      }}>
        <div className="ticker-track">
          {doubled.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 32px',
              borderRight: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--muted)',
              }}>{item.player}</span>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--accent)',
              }}>{item.stat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section style={{
        maxWidth: '880px',
        margin: '0 auto',
        padding: '80px 24px',
      }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '48px',
          textAlign: 'center',
        }}>
          How it works
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '2px',
        }}>
          {[
            {
              n: '01',
              title: 'Create your team',
              body: 'Name your squad. You get an invite code to share with teammates.',
            },
            {
              n: '02',
              title: 'Log every game',
              body: 'After each game, drop in points, assists, rebounds, steals, and blocks.',
            },
            {
              n: '03',
              title: 'See who leads',
              body: 'The leaderboard updates live. Sort by any stat, any time.',
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="card" style={{ padding: '32px', borderRadius: '0' }}>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: 'var(--accent)',
                marginBottom: '16px',
              }}>{n}</div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                color: 'var(--text)',
                marginBottom: '10px',
              }}>{title}</div>
              <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Join a Team */}
      <section style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '12px',
          }}>
            Join a team
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 6vw, 48px)',
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: 'var(--text)',
            margin: '0 0 36px',
          }}>
            Got a code?<br />Find your team.
          </h2>

          <form onSubmit={handleFindTeam} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="label" htmlFor="lp-invite-code">Invite code</label>
              <input
                id="lp-invite-code"
                className="field"
                type="text"
                placeholder="e.g. X4K9PQ"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                maxLength={6}
                style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
                autoComplete="off"
              />
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                Ask your coach or team captain for the 6-character code.
              </p>
            </div>

            {joinError && (
              <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{joinError}</p>
            )}

            <button type="submit" className="btn-primary" disabled={joinLoading} style={{ width: '100%' }}>
              {joinLoading ? 'Looking up…' : 'Find Team'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
