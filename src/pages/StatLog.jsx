import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const today = () => new Date().toISOString().split('T')[0]

export default function StatLog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const preselectedTeam = searchParams.get('team') || ''

  const [teams, setTeams] = useState([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    team_id: preselectedTeam,
    player_id: '',
    game_date: today(),
    points: '',
    assists: '',
    rebounds: '',
    steals: '',
    blocks: '',
  })

  useEffect(() => {
    if (!user) return
    supabase.from('teams').select('id, name')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTeams(data || [])
        setTeamsLoaded(true)
      })
  }, [user])

  useEffect(() => {
    if (!form.team_id) { setPlayers([]); return }
    supabase.from('players').select('id, name').eq('team_id', form.team_id).order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [form.team_id])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.team_id) { setError('Select a team.'); return }
    if (!form.player_id) { setError('Select a player.'); return }

    setLoading(true)
    const playerId = form.player_id

    const { error: se } = await supabase.from('game_stats').insert([{
      player_id:       playerId,
      team_id:         form.team_id,
      game_date:       form.game_date,
      points:          Number(form.points) || 0,
      assists:         Number(form.assists) || 0,
      rebounds:        Number(form.rebounds) || 0,
      steals:          Number(form.steals) || 0,
      blocks:          Number(form.blocks) || 0,
    }])

    setLoading(false)
    if (se) { setError(se.message); return }
    setSuccess(true)
    setTimeout(() => navigate(`/team/${form.team_id}`), 1400)
  }

  if (teamsLoaded && teams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px',
          fontWeight: 800, color: 'var(--border)', textTransform: 'uppercase',
          letterSpacing: '-0.02em',
        }}>Nope.</div>
        <p style={{ color: 'var(--muted)', marginTop: '16px', fontSize: '15px', lineHeight: 1.6, maxWidth: '380px', margin: '16px auto 0' }}>
          Only team coaches can log stats. Create a team first, or ask your coach to log your game stats.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '28px' }}>
          <Link to="/create" className="btn-primary">Create a Team</Link>
          <Link to="/" className="btn-ghost">Go Home</Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px',
          fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
          letterSpacing: '-0.02em',
        }}>Dropped.</div>
        <p style={{ color: 'var(--muted)', marginTop: '12px' }}>Stats saved. Heading to the leaderboard…</p>
      </div>
    )
  }

  const statFields = [
    { key: 'points',          label: 'Points',          unit: '',  step: '1',   min: '0', max: '200' },
    { key: 'assists',         label: 'Assists',         unit: '',  step: '1',   min: '0', max: '50'  },
    { key: 'rebounds',        label: 'Rebounds',        unit: '',  step: '1',   min: '0', max: '50'  },
    { key: 'steals',          label: 'Steals',          unit: '',  step: '1',   min: '0', max: '20'  },
    { key: 'blocks',          label: 'Blocks',          unit: '',  step: '1',   min: '0', max: '20'  },
  ]

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '48px 24px' }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'var(--accent)', marginBottom: '12px',
      }}>Game log</p>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 7vw, 52px)',
        fontWeight: 800, lineHeight: 0.95,
        letterSpacing: '-0.02em', textTransform: 'uppercase',
        color: 'var(--text)', margin: '0 0 40px',
      }}>Log<br />Stats</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Team */}
        <div>
          <label className="label" htmlFor="team">Team</label>
          <select id="team" className="field" value={form.team_id} onChange={e => set('team_id', e.target.value)} required>
            <option value="">Select a team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Player */}
        {form.team_id && (
          <div>
            <label className="label" htmlFor="player">Player</label>
            <select id="player" className="field" value={form.player_id} onChange={e => set('player_id', e.target.value)}>
              <option value="">Select a player</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="label" htmlFor="game-date">Game date</label>
          <input
            id="game-date"
            className="field"
            type="date"
            value={form.game_date}
            onChange={e => set('game_date', e.target.value)}
            required
          />
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
          <p className="label" style={{ marginBottom: '16px' }}>Stats from this game</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {statFields.map(({ key, label, unit, step, min, max }) => (
              <div key={key}>
                <label className="label" htmlFor={key}>
                  {label}{unit ? ` (${unit})` : ''}
                </label>
                <input
                  id={key}
                  className="field"
                  type="number"
                  min={min} max={max} step={step}
                  placeholder="0"
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  style={{ fontFamily: 'var(--font-data)' }}
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
          {loading ? 'Saving…' : 'Drop Stats'}
        </button>
      </form>
    </div>
  )
}
