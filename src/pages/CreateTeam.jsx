import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function CreateTeam() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Team name is required.'); return }
    setLoading(true)
    setError('')

    const invite_code = randomCode()
    const { data, error: err } = await supabase
      .from('teams')
      .insert([{ name: name.trim(), sport: 'Basketball', invite_code, coach_id: user.id }])
      .select()
      .single()

    setLoading(false)
    if (err) { setError(err.message); return }
    navigate(`/team/${data.id}`)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px' }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'var(--accent)', marginBottom: '12px',
      }}>New team</p>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 7vw, 52px)',
        fontWeight: 800, lineHeight: 0.95,
        letterSpacing: '-0.02em', textTransform: 'uppercase',
        color: 'var(--text)', margin: '0 0 40px',
      }}>Create<br />Your Squad</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label className="label" htmlFor="team-name">Team name</label>
          <input
            id="team-name"
            className="field"
            type="text"
            placeholder="e.g. Westside Wolves"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        {error && (
          <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Creating…' : 'Create Team'}
        </button>
      </form>
    </div>
  )
}
