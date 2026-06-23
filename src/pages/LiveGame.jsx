import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const today = () => new Date().toISOString().split('T')[0]

const STATS = [
  { key: 'points',   label: 'PTS', color: '#1A5CFF', bg: 'rgba(26,92,255,0.13)' },
  { key: 'assists',  label: 'AST', color: '#FF6B2B', bg: 'rgba(255,107,43,0.13)' },
  { key: 'rebounds', label: 'REB', color: '#06B6D4', bg: 'rgba(6,182,212,0.13)' },
  { key: 'steals',   label: 'STL', color: '#10B981', bg: 'rgba(16,185,129,0.13)' },
  { key: 'blocks',   label: 'BLK', color: '#8B5CF6', bg: 'rgba(139,92,246,0.13)' },
]

const ZERO = { points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 }

export default function LiveGame() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(searchParams.get('team') || '')
  const [gameStarted, setGameStarted] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [ended, setEnded] = useState(false)

  const [playerTotals, setPlayerTotals] = useState({})  // { [playerId]: { points, … } }
  const [flash, setFlash] = useState({})                 // { [playerId]: statKey | null }
  const [savingSet, setSavingSet] = useState(new Set())  // player IDs currently saving

  const totalsRef = useRef({})    // always-current mirror of playerTotals for stale-free reads
  const recordIds = useRef({})    // { [playerId]: supabase row id }
  const pendingRef = useRef({})   // { [playerId]: latest totals to save }
  const savingFlags = useRef({})  // { [playerId]: boolean } — tracks active save loops

  useEffect(() => {
    if (!user) return
    supabase.from('teams').select('id,name')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTeams(data || []))
  }, [user])

  useEffect(() => {
    if (!selectedTeam) { setPlayers([]); return }
    supabase.from('players').select('id,name')
      .eq('team_id', selectedTeam)
      .order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [selectedTeam])

  async function savePlayer(playerId, totals) {
    if (recordIds.current[playerId]) {
      await supabase.from('game_stats')
        .update({ ...totals })
        .eq('id', recordIds.current[playerId])
    } else {
      const { data, error } = await supabase.from('game_stats')
        .insert([{
          player_id: playerId,
          team_id: selectedTeam,
          game_date: today(),
          shot_percentage: 0,
          ...totals,
        }])
        .select()
        .single()
      if (!error && data) recordIds.current[playerId] = data.id
    }
  }

  async function runSaveLoop(playerId) {
    savingFlags.current[playerId] = true
    setSavingSet(prev => new Set([...prev, playerId]))
    try {
      while (pendingRef.current[playerId]) {
        const snap = pendingRef.current[playerId]
        delete pendingRef.current[playerId]
        await savePlayer(playerId, snap)
      }
    } catch (err) {
      console.error('Save failed for player', playerId, err)
    } finally {
      savingFlags.current[playerId] = false
      setSavingSet(prev => { const s = new Set(prev); s.delete(playerId); return s })
    }
  }

  function handleTap(playerId, statKey) {
    const cur = totalsRef.current[playerId] || { ...ZERO }
    const next = { ...cur, [statKey]: cur[statKey] + 1 }
    totalsRef.current[playerId] = next
    pendingRef.current[playerId] = next
    setPlayerTotals(prev => ({ ...prev, [playerId]: next }))

    setFlash(prev => ({ ...prev, [playerId]: statKey }))
    setTimeout(() => {
      setFlash(prev => prev[playerId] === statKey ? { ...prev, [playerId]: null } : prev)
    }, 220)

    if (!savingFlags.current[playerId]) runSaveLoop(playerId)
  }

  function startGame() {
    if (!selectedTeam) { setSetupError('Select a team.'); return }
    if (players.length === 0) { setSetupError('This team has no players yet.'); return }
    setSetupError('')
    recordIds.current = {}
    pendingRef.current = {}
    savingFlags.current = {}
    const init = {}
    players.forEach(p => {
      init[p.id] = { ...ZERO }
      totalsRef.current[p.id] = { ...ZERO }
    })
    setPlayerTotals(init)
    setFlash({})
    setSavingSet(new Set())
    setGameStarted(true)
  }

  function handleEndGame() {
    setEnded(true)
    setTimeout(() => navigate(`/team/${selectedTeam}`), 1600)
  }

  // Team-wide totals for the scoreboard
  const teamTotals = Object.values(playerTotals).reduce((acc, t) => {
    STATS.forEach(({ key }) => { acc[key] = (acc[key] || 0) + (t[key] || 0) })
    return acc
  }, {})

  const anyUnsaved = savingSet.size > 0

  // — Auth guard —
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>Sign in to use Live Mode.</p>
        <Link to="/login" className="btn-primary">Sign In</Link>
      </div>
    )
  }

  // — No teams —
  if (teams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: 800,
          color: 'var(--border)', textTransform: 'uppercase', letterSpacing: '-0.02em',
        }}>Hold up.</div>
        <p style={{ color: 'var(--muted)', marginTop: '16px', maxWidth: '360px', margin: '16px auto 0' }}>
          Live mode is for coaches. Create a team first.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '28px' }}>
          <Link to="/create" className="btn-primary">Create a Team</Link>
          <Link to="/" className="btn-ghost">Go Home</Link>
        </div>
      </div>
    )
  }

  // — Game over —
  if (ended) {
    const teamName = teams.find(t => t.id === selectedTeam)?.name || 'Team'
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px', fontWeight: 800,
          color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '-0.02em',
        }}>Game<br />Over.</div>
        <p style={{ color: 'var(--muted)', marginTop: '12px' }}>
          {teamName} · {teamTotals.points || 0} pts · {teamTotals.assists || 0} ast · {teamTotals.rebounds || 0} reb
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>Loading leaderboard…</p>
      </div>
    )
  }

  // — Setup —
  if (!gameStarted) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 24px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: '#E11D48', marginBottom: '12px',
        }}>Live Mode</p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 7vw, 52px)',
          fontWeight: 800, lineHeight: 0.95,
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          color: 'var(--text)', margin: '0 0 40px',
        }}>Track<br />Live</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label" htmlFor="live-team">Team</label>
            <select
              id="live-team" className="field" value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              <option value="">Select a team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {selectedTeam && players.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <p className="label" style={{ marginBottom: '8px' }}>
                Tracking {players.length} player{players.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {players.map(p => (
                  <span key={p.id} style={{
                    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    background: 'var(--ground)', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '4px 10px', color: 'var(--text)',
                  }}>{p.name}</span>
                ))}
              </div>
            </div>
          )}

          {selectedTeam && players.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
              No players on this team yet.{' '}
              <Link to="/dashboard" style={{ color: 'var(--accent)' }}>Add players in dashboard.</Link>
            </p>
          )}

          {setupError && <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{setupError}</p>}

          <button
            className="btn-primary" onClick={startGame}
            style={{ width: '100%', fontSize: '16px', padding: '14px' }}
          >
            Start Tracking
          </button>
        </div>
      </div>
    )
  }

  // — Game tracking view —
  const teamName = teams.find(t => t.id === selectedTeam)?.name || ''

  return (
    <div style={{ background: 'var(--ground)', minHeight: '100svh' }}>

      {/* Sticky header: team label + scoreboard */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '10px 14px',
      }}>
        {/* Team name + save indicator + End Game */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
              background: '#E11D48', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(225,29,72,0.22)',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text)',
            }}>{teamName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '10px', letterSpacing: '0.05em',
              color: anyUnsaved ? '#FF6B2B' : '#10B981',
              transition: 'color 0.3s',
            }}>
              {anyUnsaved ? '● saving' : '● saved'}
            </span>
            <button
              onClick={handleEndGame}
              style={{
                padding: '7px 15px', borderRadius: '7px',
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--muted)', fontFamily: 'var(--font-display)',
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
            >
              End Game
            </button>
          </div>
        </div>

        {/* Live team scoreboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '4px' }}>
          {STATS.map(({ key, label, color }) => (
            <div key={key} style={{
              textAlign: 'center', padding: '7px 2px',
              background: 'var(--ground)', borderRadius: '7px',
            }}>
              <div style={{
                fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                color, lineHeight: 1,
              }}>
                {teamTotals[key] || 0}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--muted)', marginTop: '2px',
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player cards */}
      <div style={{
        padding: '12px 12px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '10px',
        maxWidth: '1280px', margin: '0 auto',
      }}>
        {players.map(player => {
          const t = playerTotals[player.id] || ZERO
          const playerFlash = flash[player.id]
          const isSaving = savingSet.has(player.id)

          return (
            <div key={player.id} className="card" style={{ padding: '14px' }}>

              {/* Player name + per-card save dot */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '10px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 800,
                  letterSpacing: '-0.01em', textTransform: 'uppercase',
                  color: 'var(--text)', lineHeight: 1,
                }}>
                  {player.name}
                </div>
                <span style={{
                  fontFamily: 'var(--font-data)', fontSize: '9px', letterSpacing: '0.05em',
                  color: isSaving ? '#FF6B2B' : 'transparent',
                  transition: 'color 0.2s',
                }}>●</span>
              </div>

              {/* Stat counters */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                gap: '4px', marginBottom: '8px',
              }}>
                {STATS.map(({ key, label, color, bg }) => (
                  <div key={key} style={{
                    textAlign: 'center', padding: '7px 2px',
                    background: playerFlash === key ? bg : 'var(--ground)',
                    borderRadius: '6px', transition: 'background 0.12s',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                      color: playerFlash === key ? color : 'var(--text)',
                      lineHeight: 1, transition: 'color 0.12s',
                    }}>
                      {t[key]}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'var(--muted)', marginTop: '1px',
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tap buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '4px' }}>
                {STATS.map(({ key, label, color, bg }) => (
                  <button
                    key={key}
                    onClick={() => handleTap(player.id, key)}
                    style={{
                      padding: '12px 2px',
                      borderRadius: '7px',
                      border: `1.5px solid ${playerFlash === key ? color : 'var(--border)'}`,
                      background: playerFlash === key ? color : 'transparent',
                      color: playerFlash === key ? '#fff' : color,
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px', fontWeight: 800,
                      letterSpacing: '0.03em', textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'background 0.1s, color 0.08s, border-color 0.08s',
                      WebkitTapHighlightColor: 'transparent',
                      userSelect: 'none', lineHeight: 1,
                    }}
                  >
                    +{label}
                  </button>
                ))}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
