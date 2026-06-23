import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await signIn(email, password)
    setLoading(false)
    if (err) { setError(err.message); return }

    // Redirect players to their profile, coaches to the intended page
    const { data: playerData } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (playerData) {
      navigate(`/player/${playerData.id}`, { replace: true })
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '60px 24px' }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'var(--accent)', marginBottom: '12px',
      }}>Sign in</p>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 7vw, 52px)',
        fontWeight: 800, lineHeight: 0.95,
        letterSpacing: '-0.02em', textTransform: 'uppercase',
        color: 'var(--text)', margin: '0 0 40px',
      }}>Welcome<br />Back</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="field"
            type="email"
            placeholder="coach@team.com"
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
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Signing in…' : 'Log In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        Don&apos;t have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign up</Link>
      </p>
    </div>
  )
}
