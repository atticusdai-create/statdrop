import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { data, error: err } = await signUp(email, password)
    setLoading(false)
    if (err) { setError(err.message); return }
    // If email confirmation is disabled in Supabase, user is immediately logged in
    if (data.session) {
      navigate('/dashboard', { replace: true })
    } else {
      setConfirmed(true)
    }
  }

  if (confirmed) {
    return (
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px',
          fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
          letterSpacing: '-0.02em', marginBottom: '16px',
        }}>Done.</div>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6 }}>
          Check your inbox to confirm your email, then{' '}
          <Link to="/login" style={{ color: 'var(--accent)' }}>log in</Link>.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '60px 24px' }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'var(--accent)', marginBottom: '12px',
      }}>Join the roster</p>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 7vw, 52px)',
        fontWeight: 800, lineHeight: 0.95,
        letterSpacing: '-0.02em', textTransform: 'uppercase',
        color: 'var(--text)', margin: '0 0 40px',
      }}>Create<br />Account</h1>

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
            placeholder="Min. 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Log in</Link>
      </p>
    </div>
  )
}
