import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const COLS = [
  { key: 'points',          label: 'PTS',     desc: 'Total points' },
  { key: 'assists',         label: 'AST',     desc: 'Total assists' },
  { key: 'rebounds',        label: 'REB',     desc: 'Total rebounds' },
  { key: 'steals',          label: 'STL',     desc: 'Total steals' },
  { key: 'blocks',          label: 'BLK',     desc: 'Total blocks' },
  { key: 'avg_net_rating',  label: 'Avg StatDrop Rtg', desc: 'Average StatDrop rating per game' },
  { key: 'games',           label: 'GP',      desc: 'Games played' },
]

function calcNetRatingForRow(r) {
  return (
    (r.points || 0) * 1 +
    (r.assists || 0) * 1.5 +
    (r.rebounds || 0) * 1.2 +
    (r.steals || 0) * 2 +
    (r.blocks || 0) * 2
  )
}

function sumStat(records, key) {
  return records.reduce((s, r) => s + (r[key] || 0), 0)
}

function SortArrow({ dir }) {
  return (
    <span style={{ fontSize: '10px', opacity: 0.7 }}>
      {dir === 'desc' ? '▼' : '▲'}
    </span>
  )
}

function generateGameReport(rawStats, rows, teamName) {
  if (!rawStats.length || !rows.length) return ''
  const validDates = rawStats.map(s => s.game_date).filter(Boolean)
  if (!validDates.length) return ''
  const latestDate = validDates.reduce((max, d) => d > max ? d : max)
  const lastGame = rawStats.filter(s => s.game_date === latestDate)
  console.log('[GameReport] most recent game_date:', latestDate, 'filtered rows:', lastGame)
  if (!lastGame.length) return ''

  const players = lastGame.map(s => {
    const row = rows.find(r => r.playerId === s.player_id)
    return {
      name: row?.name || s.players?.name || 'Unknown',
      points: s.points || 0,
      assists: s.assists || 0,
      rebounds: s.rebounds || 0,
      steals: s.steals || 0,
      blocks: s.blocks || 0,
      rating: calcNetRatingForRow(s),
    }
  }).sort((a, b) => b.rating - a.rating)

  const teamPts = players.reduce((s, p) => s + p.points, 0)
  const teamAst = players.reduce((s, p) => s + p.assists, 0)
  const teamReb = players.reduce((s, p) => s + p.rebounds, 0)
  const avgRating = (players.reduce((s, p) => s + p.rating, 0) / players.length).toFixed(1)
  const mvp = players[0]
  const dateStr = new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  let r = `On ${dateStr}, ${teamName} combined for ${teamPts} points, ${teamAst} assists, and ${teamReb} rebounds. `

  r += `${mvp.name} led the way with a game-high StatDrop Rating of ${mvp.rating.toFixed(1)}`
  const mvpH = []
  if (mvp.points >= 12) mvpH.push(`${mvp.points} pts`)
  if (mvp.assists >= 5) mvpH.push(`${mvp.assists} ast`)
  if (mvp.rebounds >= 7) mvpH.push(`${mvp.rebounds} reb`)
  if (mvp.steals >= 3) mvpH.push(`${mvp.steals} stl`)
  if (mvp.blocks >= 3) mvpH.push(`${mvp.blocks} blk`)
  if (mvpH.length) r += ` (${mvpH.join(', ')})`
  r += `. `

  if (players.length >= 2) {
    const p2 = players[1]
    const p2H = []
    if (p2.points >= 10) p2H.push(`${p2.points} pts`)
    if (p2.assists >= 4) p2H.push(`${p2.assists} ast`)
    if (p2.rebounds >= 6) p2H.push(`${p2.rebounds} reb`)
    if (p2H.length) r += `${p2.name} added ${p2H.join(', ')}. `
  }

  const bestDef = [...players].sort((a, b) => (b.steals + b.blocks) - (a.steals + a.blocks))[0]
  if (bestDef.steals + bestDef.blocks >= 3) {
    if (bestDef.steals >= 2 && bestDef.blocks >= 2) {
      r += `${bestDef.name} was a force on both ends with ${bestDef.steals} steals and ${bestDef.blocks} blocks. `
    } else if (bestDef.steals >= 3) {
      r += `${bestDef.name} recorded ${bestDef.steals} steals, disrupting the opposing offense. `
    } else if (bestDef.blocks >= 3) {
      r += `${bestDef.name} protected the rim with ${bestDef.blocks} blocks. `
    }
  }

  const topReb = [...players].sort((a, b) => b.rebounds - a.rebounds)[0]
  if (topReb.rebounds >= 10 && topReb.name !== mvp.name) {
    r += `${topReb.name} dominated the glass with ${topReb.rebounds} rebounds. `
  }

  const perf = avgRating >= 20 ? 'dominant' : avgRating >= 14 ? 'solid' : avgRating >= 8 ? 'competitive' : 'developing'
  r += `The team averaged a ${avgRating} StatDrop Rating per player — a ${perf} collective performance.`
  return r
}

function suggestLineup(rows) {
  if (!rows.length) return []
  const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']
  const sorted = [...rows].sort((a, b) => b.avg_net_rating - a.avg_net_rating)
  const used = new Set()
  const lineup = []

  for (const pos of POSITIONS) {
    const match = sorted.find(r => r.position === pos && !used.has(r.playerId))
    if (match) { lineup.push({ player: match, slot: pos, outOfPosition: false }); used.add(match.playerId) }
  }

  const filledSlots = new Set(lineup.map(l => l.slot))
  for (const slot of POSITIONS.filter(p => !filledSlots.has(p))) {
    const fill = sorted.find(r => !used.has(r.playerId))
    if (fill) { lineup.push({ player: fill, slot, outOfPosition: !!(fill.position && fill.position !== slot) }); used.add(fill.playerId) }
  }

  return lineup.sort((a, b) => POSITIONS.indexOf(a.slot) - POSITIONS.indexOf(b.slot))
}

function pickReason({ player, slot, outOfPosition }) {
  const { name, avg_net_rating: rating, games, points, assists, rebounds } = player
  const parts = []
  if (outOfPosition) parts.push(`Filling in at ${slot} from their natural ${player.position} position.`)
  if (rating >= 22) parts.push(`Team's highest StatDrop Rating (${rating} avg) — automatic starter.`)
  else if (rating >= 16) parts.push(`Strong ${rating} avg rating over ${games} game${games !== 1 ? 's' : ''} earns the starting spot.`)
  else if (rating >= 10) parts.push(`Reliable presence averaging ${rating} StatDrop Rating per game.`)
  else parts.push(`Best available for this slot (${rating} avg StatDrop Rating).`)
  if (slot === 'PG' && assists > 5) parts.push(`${assists} total assists shows ability to run the offense.`)
  else if ((slot === 'C' || slot === 'PF') && rebounds > 8) parts.push(`${rebounds} total rebounds provides interior presence.`)
  else if ((slot === 'SG' || slot === 'SF') && points > 15) parts.push(`${points} total points is a scoring threat on the wing.`)
  return parts.join(' ')
}

function generateComparison(rows, id1, id2) {
  const a = rows.find(r => r.playerId === id1)
  const b = rows.find(r => r.playerId === id2)
  if (!a || !b) return ''

  const pg = (row, stat) => row.games > 0 ? row[stat] / row.games : 0
  const cats = [
    { label: 'scoring',           aV: pg(a, 'points'),   bV: pg(b, 'points') },
    { label: 'playmaking',        aV: pg(a, 'assists'),  bV: pg(b, 'assists') },
    { label: 'rebounding',        aV: pg(a, 'rebounds'), bV: pg(b, 'rebounds') },
    { label: 'perimeter defense', aV: pg(a, 'steals'),   bV: pg(b, 'steals') },
    { label: 'rim protection',    aV: pg(a, 'blocks'),   bV: pg(b, 'blocks') },
  ]
  const aEdge = cats.filter(c => c.aV > c.bV * 1.15).map(c => c.label)
  const bEdge = cats.filter(c => c.bV > c.aV * 1.15).map(c => c.label)

  const better = a.avg_net_rating >= b.avg_net_rating ? a : b
  const other  = better === a ? b : a
  const betterEdge = better === a ? aEdge : bEdge
  const otherEdge  = better === a ? bEdge : aEdge
  const fmt = list => list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]

  let text = `${a.name} (${a.avg_net_rating} avg rating, ${a.games} GP) vs. ${b.name} (${b.avg_net_rating} avg rating, ${b.games} GP). `
  text += `${better.name} has the overall edge`
  if (betterEdge.length) text += `, leading in ${fmt(betterEdge)}`
  text += `. `
  if (otherEdge.length) text += `${other.name} counters with stronger ${fmt(otherEdge)}. `

  if (a.position && b.position) {
    if (a.position === b.position) {
      text += `Both play ${a.position}, making this a direct positional battle — ${better.name} currently holds the starting edge, while ${other.name} provides depth at the same spot. `
    } else {
      text += `With ${a.name} at ${a.position} and ${b.name} at ${b.position}, they can share the floor rather than competing for the same role. `
    }
  }

  text += `Bottom line: ${better.name} is the stronger statistical producer right now`
  if (otherEdge.length) text += `, though ${other.name}'s ${otherEdge[0]} gives the team a dimension worth preserving`
  text += `.`
  return text
}

export default function TeamLeaderboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [team, setTeam] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('avg_net_rating')
  const [sortDir, setSortDir] = useState('desc')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', position: '', jerseyNumber: '', height: '', dateOfBirth: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [rawStats, setRawStats] = useState([])
  const [gameReport, setGameReport] = useState('')
  const [lineupResult, setLineupResult] = useState(null)
  const [compareP1, setCompareP1] = useState('')
  const [compareP2, setCompareP2] = useState('')
  const [comparisonText, setComparisonText] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: teamData, error: teamErr }, { data: stats, error: statsErr }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', id).single(),
        supabase.from('game_stats').select('*, players(name, last_name, position, jersey_number)').eq('team_id', id),
      ])
      if (teamErr || !teamData) { setError('Team not found.'); setLoading(false); return }
      if (statsErr) { setError(statsErr.message); setLoading(false); return }
      setTeam(teamData)

      const byPlayer = {}
      for (const s of (stats || [])) {
        const pid = s.player_id
        if (!byPlayer[pid]) byPlayer[pid] = { playerId: pid, name: s.players?.name || 'Unknown', lastName: s.players?.last_name || null, position: s.players?.position || '', jerseyNumber: s.players?.jersey_number ?? null, records: [] }
        byPlayer[pid].records.push(s)
      }

      const compiled = Object.values(byPlayer).map(({ playerId, name, lastName, position, jerseyNumber, records }) => {
        const games = records.length
        const netSum = records.reduce((s, r) => s + calcNetRatingForRow(r), 0)
        return {
          playerId,
          name,
          lastName,
          position,
          jerseyNumber,
          games,
          points:          sumStat(records, 'points'),
          assists:         sumStat(records, 'assists'),
          rebounds:        sumStat(records, 'rebounds'),
          steals:          sumStat(records, 'steals'),
          blocks:          sumStat(records, 'blocks'),
          avg_net_rating:  games > 0 ? +(netSum / games).toFixed(1) : 0,
        }
      })

      compiled.sort((a, b) => b.avg_net_rating - a.avg_net_rating)
      setRows(compiled)
      setRawStats(stats || [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`leaderboard-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats', filter: `team_id=eq.${id}` }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rows, sortKey, sortDir])

  const netRankings = useMemo(() =>
    [...rows].sort((a, b) => b.avg_net_rating - a.avg_net_rating),
    [rows]
  )

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  async function handleAddPlayer(e) {
    e.preventDefault()
    setAddError('')
    if (!addForm.firstName.trim()) { setAddError('First name is required.'); return }
    const fullName = [addForm.firstName.trim(), addForm.lastName.trim()].filter(Boolean).join(' ')
    setAddLoading(true)
    const { error: pe } = await supabase
      .from('players')
      .insert([{
        name: fullName,
        last_name: addForm.lastName.trim() || null,
        position: addForm.position.trim() || null,
        jersey_number: addForm.jerseyNumber ? parseInt(addForm.jerseyNumber, 10) : null,
        height: addForm.height.trim() || null,
        date_of_birth: addForm.dateOfBirth || null,
        team_id: id,
      }])
    setAddLoading(false)
    if (pe) { setAddError(pe.message); return }
    setAddSuccess(`${fullName} added to the roster.`)
    setAddForm({ firstName: '', lastName: '', position: '', jerseyNumber: '', height: '', dateOfBirth: '' })
    setTimeout(() => { setAddSuccess(''); setShowAddPlayer(false) }, 1500)
  }

  async function handleRemovePlayer() {
    if (!removeTarget) return
    setRemoveLoading(true)
    setRemoveError('')
    const { error: err, count } = await supabase
      .from('players')
      .delete({ count: 'exact' })
      .eq('id', removeTarget.playerId)
    setRemoveLoading(false)
    if (err) {
      console.error('Failed to remove player:', err)
      setRemoveError(err.message)
      return
    }
    if (count === 0) {
      console.error('Remove player blocked by RLS (count 0):', removeTarget)
      setRemoveError('Could not remove player — permission denied.')
      return
    }
    setRows(prev => prev.filter(r => r.playerId !== removeTarget.playerId))
    setRemoveTarget(null)
  }

  if (loading) return <LoadState />
  if (error)   return <ErrState msg={error} />

  const isCoach = !!user && user.id === team?.coach_id
  console.log('[TeamLeaderboard] user.id:', user?.id, '| team.coach_id:', team?.coach_id, '| isCoach:', isCoach)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'var(--accent)', marginBottom: '8px',
        }}>Basketball</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 7vw, 56px)',
            fontWeight: 800, lineHeight: 0.95,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            color: 'var(--text)', margin: 0,
          }}>{team.name}</h1>
          <div className="leaderboard-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <Link
              to={`/team/${id}/season`}
              style={{
                padding: '8px 18px', fontSize: '14px', fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: '#F59E0B', color: '#FFFFFF',
                border: 'none', borderRadius: '8px',
                fontFamily: 'var(--font-body)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              🏆 Season Summary
            </Link>
            {isCoach && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '12px',
                color: 'var(--muted)', letterSpacing: '0.08em',
              }}>
                CODE: <strong style={{ color: 'var(--text)' }}>{team.invite_code}</strong>
              </span>
            )}
            {isCoach && (
              <Link to={`/live?team=${id}`} className="btn-primary" style={{
                padding: '8px 18px', fontSize: '14px',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}>
                Track Stats Live
              </Link>
            )}
            {isCoach && (
              <button
                className="btn-ghost"
                onClick={() => { setShowAddPlayer(true); setAddError(''); setAddSuccess(''); setAddForm({ name: '', position: '', jerseyNumber: '', height: '', dateOfBirth: '' }) }}
                style={{ padding: '8px 18px', fontSize: '14px' }}
              >
                + Add Player
              </button>
            )}
            {isCoach && (
              <Link to={`/log?team=${id}`} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                + Log Stats
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }} onClick={e => { if (e.target === e.currentTarget) setShowAddPlayer(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--text)', margin: '0 0 24px',
            }}>Add Player</h2>
            {addSuccess ? (
              <p style={{ color: '#10B981', fontFamily: 'var(--font-data)', fontSize: '14px', margin: 0 }}>{addSuccess}</p>
            ) : (
              <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-name-row" style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label" htmlFor="add-first-name">First Name</label>
                    <input
                      id="add-first-name"
                      className="field"
                      type="text"
                      placeholder="e.g. Marcus"
                      value={addForm.firstName}
                      onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label" htmlFor="add-last-name">Last Name</label>
                    <input
                      id="add-last-name"
                      className="field"
                      type="text"
                      placeholder="e.g. Johnson"
                      value={addForm.lastName}
                      onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="add-position">Position</label>
                  <select
                    id="add-position"
                    className="field"
                    value={addForm.position}
                    onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))}
                  >
                    <option value="">Select position</option>
                    <option value="PG">PG – Point Guard</option>
                    <option value="SG">SG – Shooting Guard</option>
                    <option value="SF">SF – Small Forward</option>
                    <option value="PF">PF – Power Forward</option>
                    <option value="C">C – Center</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="add-jersey">Jersey Number</label>
                  <input
                    id="add-jersey"
                    className="field"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="e.g. 23"
                    value={addForm.jerseyNumber}
                    onChange={e => setAddForm(f => ({ ...f, jerseyNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="add-height">Height</label>
                  <input
                    id="add-height"
                    className="field"
                    type="text"
                    placeholder="e.g. 6'2&quot;"
                    value={addForm.height}
                    onChange={e => setAddForm(f => ({ ...f, height: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="add-date-of-birth">Date of birth</label>
                  <input
                    id="add-date-of-birth"
                    className="field"
                    type="date"
                    min="1960-01-01"
                    max="2015-12-31"
                    value={addForm.dateOfBirth}
                    onChange={e => setAddForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                {addError && (
                  <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{addError}</p>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button type="submit" className="btn-primary" disabled={addLoading} style={{ flex: 1 }}>
                    {addLoading ? 'Adding…' : 'Add Player'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowAddPlayer(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Remove Player Confirmation Modal */}
      {removeTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }} onClick={e => { if (e.target === e.currentTarget && !removeLoading) setRemoveTarget(null) }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '32px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--text)', margin: '0 0 12px',
            }}>Remove Player</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px', lineHeight: '1.6' }}>
              Remove <strong style={{ color: 'var(--text)' }}>{removeTarget.name}</strong> from the roster?
              This will permanently delete their player record and all game stats.
            </p>
            {removeError && (
              <p style={{ color: '#E53E3E', fontSize: '13px', margin: '0 0 16px' }}>{removeError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleRemovePlayer}
                disabled={removeLoading}
                style={{
                  flex: 1, padding: '10px 16px', fontSize: '14px', fontWeight: 600,
                  background: '#E53E3E', color: '#fff', border: 'none',
                  borderRadius: '8px', cursor: removeLoading ? 'not-allowed' : 'pointer',
                  opacity: removeLoading ? 0.7 : 1,
                }}
              >
                {removeLoading ? 'Removing…' : 'Remove'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setRemoveTarget(null)}
                disabled={removeLoading}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState teamId={id} isCoach={isCoach} />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', borderRadius: '12px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{
                      padding: '14px 20px', textAlign: 'left',
                      fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}>Player</th>
                    {COLS.map(col => (
                      <th key={col.key} style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <button
                          className={`sort-btn ${sortKey === col.key ? 'active' : ''}`}
                          onClick={() => handleSort(col.key)}
                          title={col.desc}
                          style={{ marginLeft: 'auto', color: col.key === 'avg_net_rating' ? '#E11D48' : undefined }}
                        >
                          {col.label}
                          {sortKey === col.key && <SortArrow dir={sortDir} />}
                        </button>
                      </th>
                    ))}
                    {isCoach && <th style={{ padding: '14px 12px', width: '40px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <tr
                      key={row.playerId}
                      onClick={() => navigate(`/player/${row.playerId}`)}
                      style={{
                        borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ground)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--accent-dim)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontWeight: 700,
                            fontSize: '13px', color: 'var(--accent)',
                            flexShrink: 0,
                          }}>
                            {i === 0 ? '★' : i + 1}
                          </div>
                          {row.jerseyNumber != null && (
                            <span style={{
                              fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700,
                              letterSpacing: '0.05em',
                              color: 'var(--muted)',
                              background: 'var(--ground)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px', padding: '2px 6px',
                              flexShrink: 0,
                            }}>#{row.jerseyNumber}</span>
                          )}
                          <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: '15px' }}>
                            {row.name}
                          </span>
                          {row.position && (
                            <span style={{
                              fontFamily: 'var(--font-data)', fontSize: '10px', fontWeight: 700,
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                              color: 'var(--muted)',
                              background: 'var(--ground)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px', padding: '2px 6px',
                              flexShrink: 0,
                            }}>{row.position}</span>
                          )}
                        </div>
                      </td>
                      {COLS.map(col => (
                        <td key={col.key} style={{ padding: '16px 12px', textAlign: 'right' }}>
                          <span style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: '14px',
                            color: col.key === 'avg_net_rating'
                              ? '#E11D48'
                              : sortKey === col.key ? 'var(--accent)' : 'var(--text)',
                            fontWeight: (col.key === 'avg_net_rating' || sortKey === col.key) ? 700 : 400,
                          }}>
                            {row[col.key]}
                          </span>
                        </td>
                      ))}
                      {isCoach && (
                        <td style={{ padding: '16px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setRemoveError(''); setRemoveTarget(row) }}
                            title="Remove player"
                            style={{
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: '6px', padding: '4px 8px',
                              cursor: 'pointer', color: 'var(--muted)',
                              fontSize: '12px', fontFamily: 'var(--font-body)',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E53E3E'; e.currentTarget.style.color = '#E53E3E' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: '12px', color: 'var(--muted)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{rows.length} player{rows.length !== 1 ? 's' : ''} · avg per game</span>
              <span>Click a row to see full profile</span>
            </div>
          </div>

          {/* Net Rating Rankings Bar Chart */}
          <div style={{ marginTop: '40px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                letterSpacing: '-0.01em', textTransform: 'uppercase',
                color: 'var(--text)', margin: '0 0 4px',
              }}>StatDrop Rating Rankings</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                [(PTS × 1) + (AST × 1.5) + (REB × 1.2) + (STL × 2) + (BLK × 2)] ÷ games played
              </p>
            </div>
            <div className="card" style={{ padding: '24px 24px 16px' }}>
              <ResponsiveContainer width="100%" height={Math.max(200, netRankings.length * 52)}>
                <BarChart
                  layout="vertical"
                  data={netRankings}
                  margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-body)' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)' }}
                    axisLine={false} tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '8px', padding: '10px 14px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        }}>
                          <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--muted)' }}>
                            {payload[0].payload.name}
                          </p>
                          <p style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '18px', fontWeight: 700, color: '#E11D48' }}>
                            {payload[0].value}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="avg_net_rating" radius={[0, 4, 4, 0]} label={{
                    position: 'right',
                    fontFamily: 'var(--font-data)',
                    fontSize: 12,
                    fontWeight: 700,
                    fill: '#E11D48',
                  }}>
                    {netRankings.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#E11D48' : 'rgba(225, 29, 72, 0.25)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Tools */}
          <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
                letterSpacing: '-0.01em', textTransform: 'uppercase',
                color: 'var(--text)', margin: 0,
              }}>AI Tools</h2>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '6px', padding: '3px 10px',
              }}>AI</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Game Report */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                      letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: 'var(--muted)', margin: '0 0 4px',
                    }}>Game Report</p>
                    <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: '1.5' }}>
                      {gameReport ? 'Last game analysis generated.' : "Summarize the team's most recent game."}
                    </p>
                  </div>
                  <button
                    onClick={() => setGameReport(generateGameReport(rawStats, rows, team.name))}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '8px', padding: '8px 16px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {gameReport ? 'Regenerate' : 'Generate Game Report'}
                  </button>
                </div>
                {gameReport && (
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.8',
                    color: 'var(--text)', margin: '20px 0 0',
                    paddingTop: '16px', borderTop: '1px solid var(--border)',
                  }}>{gameReport}</p>
                )}
              </div>

              {/* Lineup Suggester */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                      letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: 'var(--muted)', margin: '0 0 4px',
                    }}>Lineup Suggester</p>
                    <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: '1.5' }}>
                      {lineupResult ? 'Recommended starting 5 below.' : 'Pick the optimal lineup based on ratings and positions.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setLineupResult(suggestLineup(rows))}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: '8px', padding: '8px 16px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {lineupResult ? 'Regenerate' : 'Suggest Lineup'}
                  </button>
                </div>
                {lineupResult && lineupResult.length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lineupResult.map((entry, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '14px', alignItems: 'flex-start',
                        background: 'var(--ground)', borderRadius: '8px', padding: '14px 16px',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--accent)', background: 'var(--accent-dim)',
                          border: '1px solid rgba(26, 92, 255, 0.25)',
                          borderRadius: '6px', padding: '3px 8px',
                          whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: '1px',
                        }}>{entry.slot}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
                            color: 'var(--text)', margin: '0 0 4px',
                          }}>{entry.player.name}</p>
                          <p style={{
                            fontFamily: 'var(--font-body)', fontSize: '12px',
                            color: 'var(--muted)', lineHeight: '1.6', margin: 0,
                          }}>{pickReason(entry)}</p>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 700,
                          color: '#E11D48', whiteSpace: 'nowrap',
                        }}>{entry.player.avg_net_rating}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Player Comparison */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--muted)', margin: '0 0 14px',
                }}>Player Comparison</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--muted)', marginBottom: '6px',
                    }}>Player 1</label>
                    <select
                      className="field"
                      value={compareP1}
                      onChange={e => { setCompareP1(e.target.value); setCompareP2(''); setComparisonText('') }}
                      style={{ fontSize: '13px' }}
                    >
                      <option value="">Select player…</option>
                      {rows.map(r => (
                        <option key={r.playerId} value={r.playerId}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--muted)', marginBottom: '6px',
                    }}>Player 2</label>
                    <select
                      className="field"
                      value={compareP2}
                      onChange={e => { setCompareP2(e.target.value); setComparisonText('') }}
                      style={{ fontSize: '13px' }}
                    >
                      <option value="">Select player…</option>
                      {rows.filter(r => r.playerId !== compareP1).map(r => (
                        <option key={r.playerId} value={r.playerId}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setComparisonText(generateComparison(rows, compareP1, compareP2))}
                    disabled={!compareP1 || !compareP2}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: !compareP1 || !compareP2 ? 'var(--muted)' : '#8B5CF6',
                      background: !compareP1 || !compareP2 ? 'var(--ground)' : 'rgba(139, 92, 246, 0.08)',
                      border: `1px solid ${!compareP1 || !compareP2 ? 'var(--border)' : 'rgba(139, 92, 246, 0.25)'}`,
                      borderRadius: '8px', padding: '8px 16px',
                      cursor: !compareP1 || !compareP2 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Compare Players
                  </button>
                </div>
                {comparisonText && (
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.8',
                    color: 'var(--text)', margin: '20px 0 0',
                    paddingTop: '16px', borderTop: '1px solid var(--border)',
                  }}>{comparisonText}</p>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LoadState() {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px', color: 'var(--muted)', fontFamily: 'var(--font-data)', fontSize: '13px' }}>
      Loading…
    </div>
  )
}

function ErrState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px' }}>
      <p style={{ color: '#E53E3E', fontSize: '15px' }}>{msg}</p>
      <Link to="/" className="btn-ghost" style={{ marginTop: '20px', display: 'inline-flex' }}>Back to home</Link>
    </div>
  )
}

function EmptyState({ teamId, isCoach }) {
  return (
    <div className="card" style={{ padding: '64px 32px', textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '72px',
        fontWeight: 800, color: 'var(--border)',
        letterSpacing: '-0.02em', textTransform: 'uppercase',
        marginBottom: '16px',
      }}>0–0</div>
      <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '24px' }}>
        No stats logged yet. {isCoach ? 'Add a game to see the leaderboard.' : 'Check back after your coach logs the first game.'}
      </p>
      {isCoach && (
        <Link to={`/log?team=${teamId}`} className="btn-primary">Log First Game</Link>
      )}
    </div>
  )
}
