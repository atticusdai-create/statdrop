import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STAT_CHARTS = [
  { key: 'points',          label: 'Points',          color: '#1A5CFF' },
  { key: 'assists',         label: 'Assists',         color: '#FF6B2B' },
  { key: 'rebounds',        label: 'Rebounds',        color: '#06B6D4' },
  { key: 'steals',          label: 'Steals',          color: '#10B981' },
  { key: 'blocks',          label: 'Blocks',          color: '#8B5CF6' },
  { key: 'net_rating',      label: 'StatDrop Rating',      color: '#E11D48' },
]

function calcNetRating(s) {
  return +(
    ((s.points || 0) * 1) +
    ((s.assists || 0) * 1.5) +
    ((s.rebounds || 0) * 1.2) +
    ((s.steals || 0) * 2) +
    ((s.blocks || 0) * 2)
  ).toFixed(2)
}

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function fmt(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function generateOverview(stats, playerName) {
  if (!stats || stats.length === 0) return null

  const n = stats.length
  const avg = {
    points:    stats.reduce((s, r) => s + r.points,    0) / n,
    assists:   stats.reduce((s, r) => s + r.assists,   0) / n,
    rebounds:  stats.reduce((s, r) => s + r.rebounds,  0) / n,
    steals:    stats.reduce((s, r) => s + r.steals,    0) / n,
    blocks:    stats.reduce((s, r) => s + r.blocks,    0) / n,
    netRating: stats.reduce((s, r) => s + r.net_rating, 0) / n,
  }
  const defAvg = avg.steals + avg.blocks

  // Role
  let role, roleDesc
  if (avg.points >= 18) {
    role = 'Primary Scorer'
    roleDesc = `a go-to offensive option averaging ${avg.points.toFixed(1)} points per game`
  } else if (avg.assists >= 6) {
    role = 'Playmaker'
    roleDesc = `the team's primary distributor with ${avg.assists.toFixed(1)} assists per game`
  } else if (avg.rebounds >= 8) {
    role = 'Rebounder'
    roleDesc = `a dominant presence on the glass, hauling in ${avg.rebounds.toFixed(1)} boards per game`
  } else if (defAvg >= 3) {
    role = 'Defensive Specialist'
    roleDesc = `a defensive anchor combining ${avg.steals.toFixed(1)} steals and ${avg.blocks.toFixed(1)} blocks per game`
  } else if (avg.points >= 12) {
    role = 'Secondary Scorer'
    roleDesc = `a reliable offensive contributor averaging ${avg.points.toFixed(1)} points per game`
  } else if (avg.assists >= 4) {
    role = 'Playmaker'
    roleDesc = `a facilitator who creates for others with ${avg.assists.toFixed(1)} assists per game`
  } else if (avg.rebounds >= 5) {
    role = 'Rebounder'
    roleDesc = `a solid rebounder averaging ${avg.rebounds.toFixed(1)} boards per game`
  } else {
    role = 'Role Player'
    roleDesc = `a versatile contributor who fills in where the team needs it`
  }

  // Strengths & weaknesses
  const statList = [
    { label: 'scoring',           val: avg.points,   unit: 'ppg', hi: 12 },
    { label: 'playmaking',        val: avg.assists,  unit: 'apg', hi: 4  },
    { label: 'rebounding',        val: avg.rebounds, unit: 'rpg', hi: 6  },
    { label: 'perimeter defense', val: avg.steals,   unit: 'spg', hi: 1.5 },
    { label: 'shot-blocking',     val: avg.blocks,   unit: 'bpg', hi: 1.5 },
  ]
  const strong = statList.filter(s => s.val >= s.hi)
  const weak   = statList.filter(s => s.val < s.hi * 0.4).sort((a, b) => (a.val / a.hi) - (b.val / b.hi))

  let strengthLine
  if (strong.length === 0) {
    strengthLine = `${playerName} hasn't yet posted standout numbers in any single category`
  } else if (strong.length === 1) {
    strengthLine = `The clearest strength is ${strong[0].label} (${strong[0].val.toFixed(1)} ${strong[0].unit})`
  } else {
    const parts = strong.map(s => `${s.label} (${s.val.toFixed(1)} ${s.unit})`)
    const last = parts.pop()
    strengthLine = `${playerName} stands out in ${parts.join(', ')} and ${last}`
  }

  let improveLine
  if (weak.length === 0) {
    improveLine = `and brings a respectable floor across all areas`
  } else if (weak.length === 1) {
    improveLine = `though ${weak[0].label} (${weak[0].val.toFixed(1)} ${weak[0].unit}) is the biggest area for growth`
  } else {
    improveLine = `though ${weak.map(w => w.label).join(' and ')} could both be elevated`
  }

  // Net rating trend
  let trend, trendLabel, trendColor, trendLine
  if (n >= 4) {
    const mid = Math.ceil(n / 2)
    const earlyAvg = stats.slice(0, mid).reduce((s, r) => s + r.net_rating, 0) / mid
    const lateAvg  = stats.slice(mid).reduce((s, r) => s + r.net_rating, 0) / (n - mid)
    const delta = lateAvg - earlyAvg
    if (delta > 2.5) {
      trend = 'improving'; trendLabel = 'Improving'; trendColor = '#10B981'
      trendLine = `StatDrop rating has climbed noticeably (+${delta.toFixed(1)} in recent games) — ${playerName} is hitting their stride`
    } else if (delta < -2.5) {
      trend = 'declining'; trendLabel = 'Declining'; trendColor = '#EF4444'
      trendLine = `StatDrop rating has dipped recently (${delta.toFixed(1)} vs earlier games) — worth addressing in practice`
    } else {
      trend = 'consistent'; trendLabel = 'Consistent'; trendColor = '#F59E0B'
      trendLine = `Performance has been steady across the sample (avg StatDrop rating: ${avg.netRating.toFixed(1)})`
    }
  } else if (n >= 2) {
    const delta = stats[n - 1].net_rating - stats[0].net_rating
    if (delta > 2) {
      trend = 'improving'; trendLabel = 'Improving'; trendColor = '#10B981'
      trendLine = `StatDrop rating trended up from ${stats[0].net_rating} to ${stats[n - 1].net_rating}`
    } else if (delta < -2) {
      trend = 'declining'; trendLabel = 'Declining'; trendColor = '#EF4444'
      trendLine = `StatDrop rating slipped from ${stats[0].net_rating} to ${stats[n - 1].net_rating}`
    } else {
      trend = 'consistent'; trendLabel = 'Consistent'; trendColor = '#F59E0B'
      trendLine = `Numbers have held steady so far (avg StatDrop rating: ${avg.netRating.toFixed(1)})`
    }
  } else {
    trend = 'consistent'; trendLabel = 'Early Data'; trendColor = '#64748B'
    trendLine = `Only one game logged — check back after a few more games for trend data`
  }

  // Coach recommendation
  let recRole, recDetail
  if (avg.netRating >= 22) {
    recRole = 'Start'
    recDetail = `${playerName}'s all-around impact makes them a cornerstone of the lineup — lock them in as a starter.`
  } else if (avg.netRating >= 16) {
    recRole = 'Starter'
    recDetail = `${playerName} earns a starting spot. Give them a defined role as ${role.toLowerCase()} and let them run with it.`
  } else if (avg.netRating >= 10) {
    if (defAvg >= 2.5) {
      recRole = 'Defensive Specialist'
      recDetail = `Bring ${playerName} off the bench in high-leverage moments — their defensive instincts change the energy of a possession.`
    } else {
      recRole = 'Key Bench Player'
      recDetail = `${playerName} is a quality reserve. Slot them into favorable matchups and let their ${role.toLowerCase()} skills spark runs.`
    }
  } else {
    recRole = 'Development Role'
    recDetail = `${playerName} is still finding their footing. Controlled minutes in low-pressure situations will accelerate their growth.`
  }

  return {
    role, trend, trendLabel, trendColor, avg,
    paragraph: `${playerName} is ${roleDesc}. ${strengthLine}, ${improveLine}. ${trendLine}.`,
    recRole, recDetail,
  }
}

function generateCoachingTips(stats) {
  if (!stats || stats.length === 0) return []
  const n = stats.length
  const avg = {
    points:   stats.reduce((s, r) => s + r.points,   0) / n,
    assists:  stats.reduce((s, r) => s + r.assists,  0) / n,
    rebounds: stats.reduce((s, r) => s + r.rebounds, 0) / n,
    steals:   stats.reduce((s, r) => s + r.steals,   0) / n,
    blocks:   stats.reduce((s, r) => s + r.blocks,   0) / n,
  }
  const drills = [
    {
      stat: 'scoring', avg: avg.points, baseline: 12,
      title: 'Spot-Up Shooting Circuits',
      body: 'Set up at 5 spots around the arc (both corners, both wings, top of key). At each spot, take 10 catch-and-shoot reps with a focus on set feet and a consistent release point. Finish each circuit with 10 free throws. Track makes-per-spot to monitor improvement over time.',
    },
    {
      stat: 'playmaking', avg: avg.assists, baseline: 4,
      title: 'Court Vision 3-on-2 Drill',
      body: 'Run a 3-on-2 shell with a passer at the top of the key. The passer cannot drive — they must read the defense and hit the open cutter or corner shooter. No dribble penetration allowed. Rotate roles every 5 reps for 15 total. Focus on identifying help-side defenders early.',
    },
    {
      stat: 'rebounding', avg: avg.rebounds, baseline: 6,
      title: 'Box-Out and React',
      body: 'Coach shoots intentional misses from the elbow. The defender must find, seal, and maintain contact with their assignment before pursuing the ball. Offensive player tries to spin free. 20 reps per side — reward low, physical positioning over jumping early.',
    },
    {
      stat: 'perimeter defense', avg: avg.steals, baseline: 1.5,
      title: 'Defensive Slide and Mirror',
      body: 'Ball handler dribbles in a 12-foot channel while the defender stays in front using only lateral slides — no reaching allowed. 10-second reps, then progress to live 1-on-1 with the ball handler starting with a step advantage. Emphasize hips low and feet never crossing.',
    },
    {
      stat: 'shot-blocking', avg: avg.blocks, baseline: 1.5,
      title: 'Verticality and Timing',
      body: "Partner shoots from the mid-range while the defender works on jumping straight up — both hands raised — without reaching or fouling. 15 reps per session. Read the shooter's hip-turn as the contest trigger. Progress gradually to live post and drive situations.",
    },
  ]
  return drills
    .map(d => ({ ...d, score: Math.max(0, d.baseline - d.avg) / d.baseline }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function CoachingTips({ stats }) {
  const [open, setOpen] = useState(false)
  const tips = generateCoachingTips(stats)
  if (!tips.length) return null

  return (
    <div className="card" style={{ padding: '28px 32px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: 0,
          }}>Coaching Tips</p>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '6px', padding: '2px 8px',
          }}>AI</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '8px', padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          {open ? 'Hide Tips' : 'Get Coaching Tips'}
        </button>
      </div>

      {!open && (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '12px 0 0', lineHeight: '1.5' }}>
          3 drill recommendations targeting this player's weakest stat categories.
        </p>
      )}

      {open && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{
              background: 'var(--ground)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700, color: '#8B5CF6' }}>
                  #{i + 1}
                </span>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
                  letterSpacing: '-0.01em', color: 'var(--text)', margin: 0, flex: 1,
                }}>{tip.title}</h3>
                <span style={{
                  fontFamily: 'var(--font-data)', fontSize: '10px', fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--muted)', background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px', padding: '2px 6px',
                }}>Focus: {tip.stat}</span>
              </div>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: '13px',
                color: 'var(--muted)', lineHeight: '1.7', margin: 0,
              }}>{tip.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerOverview({ stats, playerName }) {
  const ov = generateOverview(stats, playerName)
  if (!ov) return null

  return (
    <div className="card" style={{ padding: '28px 32px', marginBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: 0,
          }}>Player Overview</p>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            background: 'rgba(26, 92, 255, 0.1)', color: '#1A5CFF',
            border: '1px solid rgba(26, 92, 255, 0.22)',
            borderRadius: '6px', padding: '3px 10px',
          }}>{ov.role}</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.05em',
          color: ov.trendColor,
          background: `${ov.trendColor}18`,
          border: `1px solid ${ov.trendColor}44`,
          borderRadius: '6px', padding: '3px 10px',
        }}>
          {ov.trend === 'improving' ? '↑ ' : ov.trend === 'declining' ? '↓ ' : '→ '}
          {ov.trendLabel}
        </span>
      </div>

      {/* Summary paragraph */}
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: '14px', lineHeight: '1.8',
        color: 'var(--text)', margin: '0 0 22px',
      }}>{ov.paragraph}</p>

      {/* Coach's call */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: '18px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
      }}>
        <span style={{
          flexShrink: 0,
          fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          background: 'rgba(225, 29, 72, 0.08)', color: '#E11D48',
          border: '1px solid rgba(225, 29, 72, 0.2)',
          borderRadius: '6px', padding: '4px 10px',
          whiteSpace: 'nowrap', marginTop: '2px',
        }}>{ov.recRole}</span>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '13px',
          color: 'var(--muted)', lineHeight: '1.65', margin: 0,
        }}>{ov.recDetail}</p>
      </div>
    </div>
  )
}

function StatChart({ data, statKey, label, color }) {
  const values = data.map(d => d[statKey])
  const max = Math.max(...values, 1)
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—'
  const last = values.length ? values[values.length - 1] : '—'
  const trend = values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: '0 0 4px',
          }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '28px', fontWeight: 700, color }}>{last}</span>
            {values.length >= 2 && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '12px',
                color: trend > 0 ? '#10B981' : trend < 0 ? '#EF4444' : 'var(--muted)',
              }}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--muted)' }}>avg</p>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '16px', color: 'var(--text)' }}>{avg}</span>
        </div>
      </div>

      {data.length >= 1 ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
          {data.map((d, i) => {
            const val = d[statKey]
            const barPct = max > 0 ? Math.max((val / max) * 80, val > 0 ? 2 : 0) : 0
            return (
              <div key={d.id || i} style={{ flex: 1, position: 'relative', height: '100%' }}>
                <span style={{
                  position: 'absolute',
                  bottom: `calc(${barPct}% + 4px)`,
                  left: 0, right: 0,
                  textAlign: 'center',
                  fontSize: '9px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--muted)',
                  lineHeight: 1,
                }}>{val}</span>
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  height: `${barPct}%`,
                  background: color,
                  borderRadius: '3px 3px 0 0',
                  minHeight: val > 0 ? '3px' : '0',
                  opacity: 0.85,
                }} />
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', fontSize: '13px',
        }}>
          No games logged yet
        </div>
      )}
    </div>
  )
}

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [player, setPlayer] = useState(null)
  const [team, setTeam] = useState(null)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    setDeleteError('')
    const { error: playerErr } = await supabase.from('players').delete().eq('id', id)
    if (playerErr) { setDeleteError(playerErr.message); setDeleteLoading(false); return }
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  function shareProfile() {
    const url = `${window.location.origin}/public/player/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    async function load() {
      const { data: playerData, error: pe } = await supabase
        .from('players')
        .select('*, teams(id, name)')
        .eq('id', id)
        .single()

      if (pe || !playerData) { setError('Player not found.'); setLoading(false); return }
      setPlayer(playerData)
      setTeam(playerData.teams)

      const { data: statData, error: se } = await supabase
        .from('game_stats')
        .select('*')
        .eq('player_id', id)
        .order('game_date', { ascending: true })

      if (se) { setError(se.message); setLoading(false); return }
      setStats((statData || []).map(s => ({ ...s, net_rating: calcNetRating(s) })))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '120px 24px', color: 'var(--muted)', fontFamily: 'var(--font-data)', fontSize: '13px' }}>Loading…</div>
  )
  if (error) return (
    <div style={{ textAlign: 'center', padding: '120px 24px' }}>
      <p style={{ color: '#E53E3E' }}>{error}</p>
      <Link to="/" className="btn-ghost" style={{ marginTop: '20px', display: 'inline-flex' }}>Home</Link>
    </div>
  )

  const totals = {
    games: stats.length,
    points: stats.reduce((s, r) => s + r.points, 0),
    assists: stats.reduce((s, r) => s + r.assists, 0),
    avgNetRating: stats.length
      ? (stats.reduce((s, r) => s + r.net_rating, 0) / stats.length).toFixed(1)
      : '—',
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '48px' }}>
        {team && (
          <Link to={`/team/${team.id}`} style={{
            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--accent)', textDecoration: 'none', marginBottom: '12px', display: 'inline-block',
          }}>
            ← {team.name}
          </Link>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', margin: '0 0 28px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(40px, 8vw, 72px)',
            fontWeight: 800, lineHeight: 0.92,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            color: 'var(--text)', margin: 0,
          }}>{player.name}</h1>
          {player.jersey_number != null && (
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--muted)',
              background: 'var(--ground)',
              border: '1px solid var(--border)',
              borderRadius: '6px', padding: '4px 12px',
              alignSelf: 'center',
            }}>#{player.jersey_number}</span>
          )}
          {player.position && (
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--accent)',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(var(--accent-rgb, 26, 92, 255), 0.25)',
              borderRadius: '6px', padding: '4px 12px',
              alignSelf: 'center',
            }}>{player.position}</span>
          )}
          {player.height && (
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--muted)',
              background: 'var(--ground)',
              border: '1px solid var(--border)',
              borderRadius: '6px', padding: '4px 12px',
              alignSelf: 'center',
            }}>{player.height}</span>
          )}
          {player.date_of_birth && (
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--muted)',
              background: 'var(--ground)',
              border: '1px solid var(--border)',
              borderRadius: '6px', padding: '4px 12px',
              alignSelf: 'center',
            }}>Age {calcAge(player.date_of_birth)}</span>
          )}
        </div>

        {/* Share + quick summary chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={shareProfile}
            style={{
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: copied ? '#10B981' : 'var(--accent)',
              background: copied ? 'rgba(16,185,129,0.08)' : 'var(--accent-dim)',
              border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(26,92,255,0.25)'}`,
              borderRadius: '8px', padding: '8px 16px',
              cursor: 'pointer', transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? '✓ Link copied!' : '↗ Share Profile'}
          </button>
          {[
            { label: 'Games', val: totals.games },
            { label: 'Total PTS', val: totals.points },
            { label: 'Total AST', val: totals.assists },
            { label: 'Avg StatDrop Rating per Game', val: totals.avgNetRating, highlight: true },
          ].map(({ label, val, highlight }) => (
            <div key={label} style={{
              background: highlight ? 'rgba(225, 29, 72, 0.06)' : 'var(--surface)',
              border: `1px solid ${highlight ? 'rgba(225, 29, 72, 0.25)' : 'var(--border)'}`,
              borderRadius: '8px', padding: '10px 18px',
            }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', color: highlight ? '#E11D48' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</p>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700, color: highlight ? '#E11D48' : 'var(--text)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="card" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>No stats logged for this player yet.</p>
        </div>
      ) : (
        <>
          <PlayerOverview stats={stats} playerName={player.name} />
          <CoachingTips stats={stats} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {STAT_CHARTS.map(({ key, label, color }) => (
              <StatChart
                key={key}
                data={stats}
                statKey={key}
                label={label}
                color={color}
              />
            ))}
          </div>
        </>
      )}

      {/* Game log table */}
      {stats.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            color: 'var(--text)', margin: '0 0 16px',
          }}>Game Log</h2>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Date', 'PTS', 'AST', 'REB', 'STL', 'BLK', 'NET'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: h === 'Date' ? 'left' : 'right',
                        fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: h === 'NET' ? '#E11D48' : 'var(--muted)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...stats].reverse().map((row, i, arr) => (
                    <tr key={row.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
                        {fmt(row.game_date)}
                      </td>
                      {['points', 'assists', 'rebounds', 'steals', 'blocks'].map(k => (
                        <td key={k} style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>
                          {row[k]}
                        </td>
                      ))}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: '#E11D48', fontWeight: 600 }}>
                        {row.net_rating}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete account — only shown to the player viewing their own profile */}
      {user && player?.user_id === user.id && (
        <div style={{ marginTop: '80px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { setDeleteError(''); setShowDeleteConfirm(true) }}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '10px 20px',
              fontSize: '13px', color: 'var(--muted)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E53E3E'; e.currentTarget.style.color = '#E53E3E' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            Delete Account
          </button>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }} onClick={e => { if (e.target === e.currentTarget && !deleteLoading) setShowDeleteConfirm(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--text)', margin: '0 0 12px',
            }}>Delete Account</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px', lineHeight: '1.6' }}>
              Are you sure? This will permanently delete your account and all your stats.
            </p>
            {deleteError && (
              <p style={{ color: '#E53E3E', fontSize: '13px', margin: '0 0 16px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{
                  flex: 1, padding: '10px 16px', fontSize: '14px', fontWeight: 600,
                  background: '#E53E3E', color: '#fff', border: 'none',
                  borderRadius: '8px', cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete My Account'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
