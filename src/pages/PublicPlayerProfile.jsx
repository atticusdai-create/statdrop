import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STAT_CHARTS = [
  { key: 'points',   label: 'Points',   color: '#1A5CFF' },
  { key: 'assists',  label: 'Assists',  color: '#FF6B2B' },
  { key: 'rebounds', label: 'Rebounds', color: '#06B6D4' },
  { key: 'steals',   label: 'Steals',   color: '#10B981' },
  { key: 'blocks',   label: 'Blocks',   color: '#8B5CF6' },
]

function prospectLevel(rating) {
  if (rating >= 25) return 'elite'
  if (rating >= 18) return 'high-level'
  if (rating >= 12) return 'solid'
  if (rating >= 7) return 'developing'
  return 'emerging'
}

function generateScoutSummary(stats, player) {
  if (!stats || stats.length === 0) return null
  const n = stats.length
  const avg = {
    points:   stats.reduce((s, r) => s + r.points,   0) / n,
    assists:  stats.reduce((s, r) => s + r.assists,  0) / n,
    rebounds: stats.reduce((s, r) => s + r.rebounds, 0) / n,
    steals:   stats.reduce((s, r) => s + r.steals,   0) / n,
    blocks:   stats.reduce((s, r) => s + r.blocks,   0) / n,
  }
  const avgRating = (stats.reduce((s, r) => s + r.net_rating, 0) / n).toFixed(1)

  let role, sentence1
  if (avg.steals >= 1.5 && avg.assists >= 4) {
    role = 'two-way playmaker'
    sentence1 = `${player.name} is a two-way playmaker who impacts both ends of the floor, averaging ${avg.assists.toFixed(1)} assists and ${avg.steals.toFixed(1)} steals per game.`
  } else if (avg.points >= 15) {
    role = 'primary scorer'
    sentence1 = `${player.name} is the team's primary scorer and offensive engine, putting up ${avg.points.toFixed(1)} points per game.`
  } else if (avg.rebounds >= 7 && avg.blocks >= 1.5) {
    role = 'defensive anchor'
    sentence1 = `${player.name} anchors the defense with ${avg.rebounds.toFixed(1)} rebounds and ${avg.blocks.toFixed(1)} blocks per game — a genuine interior presence.`
  } else if (avg.assists >= 5) {
    role = 'playmaker'
    sentence1 = `${player.name} is a true playmaker who orchestrates the offense, dishing out ${avg.assists.toFixed(1)} assists per game.`
  } else if (avg.rebounds >= 8) {
    role = 'rebounding force'
    sentence1 = `${player.name} is a dominant rebounding force, hauling in ${avg.rebounds.toFixed(1)} boards per game.`
  } else if (avg.blocks >= 2) {
    role = 'shot-blocker'
    sentence1 = `${player.name} protects the paint as a premier shot-blocker, swatting ${avg.blocks.toFixed(1)} shots per game.`
  } else if (avg.points >= 10) {
    role = 'scoring threat'
    sentence1 = `${player.name} is a reliable scoring threat, contributing ${avg.points.toFixed(1)} points per game.`
  } else {
    role = 'versatile contributor'
    sentence1 = `${player.name} is a versatile contributor who brings effort and energy across multiple areas of the game.`
  }

  const extras = []
  if (!['primary scorer', 'scoring threat'].includes(role) && avg.points >= 10) extras.push(`${avg.points.toFixed(1)} ppg`)
  if (!['two-way playmaker', 'playmaker'].includes(role) && avg.assists >= 3) extras.push(`${avg.assists.toFixed(1)} apg`)
  if (!['rebounding force', 'defensive anchor'].includes(role) && avg.rebounds >= 5) extras.push(`${avg.rebounds.toFixed(1)} rpg`)
  if (role !== 'two-way playmaker' && avg.steals >= 1) extras.push(`${avg.steals.toFixed(1)} spg`)
  if (!['shot-blocker', 'defensive anchor'].includes(role) && avg.blocks >= 1) extras.push(`${avg.blocks.toFixed(1)} bpg`)

  const sentence2 = extras.length >= 2
    ? `The full stat line rounds out the picture: ${extras.slice(0, 3).join(', ')}.`
    : extras.length === 1
      ? `The stat sheet also shows ${extras[0]} as a consistent secondary contribution.`
      : ''

  const sentence3 = `Carrying a StatDrop Rating of ${avgRating} across ${n} game${n !== 1 ? 's' : ''}, ${player.name} is a ${prospectLevel(parseFloat(avgRating))} prospect worth tracking.`

  return [sentence1, sentence2, sentence3].filter(Boolean).join(' ')
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

function calcNetRating(s) {
  return +(
    ((s.points || 0) * 1) +
    ((s.assists || 0) * 1.5) +
    ((s.rebounds || 0) * 1.2) +
    ((s.steals || 0) * 2) +
    ((s.blocks || 0) * 2)
  ).toFixed(2)
}

function PublicBarChart({ data, statKey, label, color }) {
  const values = data.map(d => d[statKey])
  const max = Math.max(...values, 1)
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0
  const total = values.reduce((a, b) => a + b, 0)

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #DDE2EC',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#8892A4', margin: '0 0 4px',
          }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '24px', fontWeight: 700, color }}>{avg.toFixed(1)}</span>
            <span style={{ fontSize: '11px', color: '#8892A4' }}>per game</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#8892A4' }}>total</p>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '16px', color: '#0C1526' }}>{total}</span>
        </div>
      </div>

      {data.length >= 1 ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
          {data.map((d, i) => {
            const val = d[statKey]
            const barPct = max > 0 ? Math.max((val / max) * 80, val > 0 ? 4 : 0) : 0
            return (
              <div key={d.id || i} style={{ flex: 1, position: 'relative', height: '100%' }}>
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
          height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#8892A4', fontSize: '13px',
        }}>No games yet</div>
      )}
    </div>
  )
}

export default function PublicPlayerProfile() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [team, setTeam] = useState(null)
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0C1526', color: 'rgba(255,255,255,0.4)',
      fontFamily: 'var(--font-data)', fontSize: '13px', letterSpacing: '0.1em',
    }}>
      Loading…
    </div>
  )

  if (error) return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0C1526',
    }}>
      <p style={{ color: '#EF4444', fontFamily: 'var(--font-body)' }}>{error}</p>
    </div>
  )

  const n = stats.length
  const scoutSummary = generateScoutSummary(stats, player)
  const totals = {
    points:   stats.reduce((s, r) => s + r.points,   0),
    assists:  stats.reduce((s, r) => s + r.assists,  0),
    rebounds: stats.reduce((s, r) => s + r.rebounds, 0),
    steals:   stats.reduce((s, r) => s + r.steals,   0),
    blocks:   stats.reduce((s, r) => s + r.blocks,   0),
  }
  const perGame = {
    points:   n ? (totals.points   / n).toFixed(1) : '—',
    assists:  n ? (totals.assists  / n).toFixed(1) : '—',
    rebounds: n ? (totals.rebounds / n).toFixed(1) : '—',
    steals:   n ? (totals.steals   / n).toFixed(1) : '—',
    blocks:   n ? (totals.blocks   / n).toFixed(1) : '—',
  }
  const avgNetRating = n
    ? (stats.reduce((s, r) => s + r.net_rating, 0) / n).toFixed(1)
    : '—'

  return (
    <div style={{ minHeight: '100svh', background: '#F4F6F9', fontFamily: 'var(--font-body)' }}>

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(150deg, #08111f 0%, #0e1e3a 50%, #12213d 100%)',
        padding: '56px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 64px)',
          pointerEvents: 'none',
        }} />
        {/* glow accent */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '360px', height: '360px',
          background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '820px', margin: '0 auto', position: 'relative' }}>

          {/* Team name */}
          {team && (
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
              letterSpacing: '0.28em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)', margin: '0 0 28px',
            }}>{team.name}</p>
          )}

          {/* Player name */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(42px, 10vw, 84px)',
            fontWeight: 900, lineHeight: 0.88,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            color: '#fff', margin: '0 0 20px',
          }}>{player.name}</h1>

          {/* Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '40px' }}>
            {player.jersey_number != null && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '6px', padding: '5px 14px',
              }}>#{player.jersey_number}</span>
            )}
            {player.position && (
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#60a5fa',
                background: 'rgba(96, 165, 250, 0.12)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '6px', padding: '5px 14px',
              }}>{player.position}</span>
            )}
            {player.height && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '6px', padding: '5px 14px',
              }}>{player.height}</span>
            )}
            {player.date_of_birth && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: '6px', padding: '5px 14px',
              }}>Age {calcAge(player.date_of_birth)}</span>
            )}
          </div>

          {/* StatDrop Rating — hero stat */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(225, 29, 72, 0.08)',
              border: '1px solid rgba(225, 29, 72, 0.28)',
              borderRadius: '16px',
              padding: '24px 36px',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.28em', textTransform: 'uppercase',
                color: 'rgba(225, 29, 72, 0.65)', margin: '0 0 6px',
              }}>StatDrop Rating</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 'clamp(56px, 14vw, 100px)',
                  fontWeight: 900, lineHeight: 1,
                  color: '#E11D48',
                }}>{avgNetRating}</span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'rgba(225,29,72,0.5)' }}>avg</span>
              </div>
            </div>

            {/* Games played */}
            <div style={{ paddingBottom: '8px' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 600,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)', margin: '0 0 4px',
              }}>Games Played</p>
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '48px', fontWeight: 800, lineHeight: 1,
                color: 'rgba(255,255,255,0.75)',
              }}>{n}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: '820px', margin: '-24px auto 0', padding: '0 24px 80px', position: 'relative' }}>

        {n > 0 ? (
          <>
            {/* Scout Summary */}
            {scoutSummary && (
              <div style={{
                background: 'linear-gradient(135deg, #0f1c35 0%, #0a1628 100%)',
                border: '1px solid rgba(96, 165, 250, 0.2)',
                borderRadius: '16px',
                padding: '28px 32px',
                marginBottom: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* accent bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: '4px',
                  background: 'linear-gradient(180deg, #1A5CFF 0%, #60a5fa 100%)',
                  borderRadius: '4px 0 0 4px',
                }} />
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.28em', textTransform: 'uppercase',
                  color: '#60a5fa', margin: '0 0 14px',
                }}>Scout Summary</p>
                <p style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '15px', lineHeight: '1.75',
                  color: 'rgba(255,255,255,0.82)',
                  margin: 0, fontStyle: 'italic',
                }}>{scoutSummary}</p>
              </div>
            )}

            {/* Totals + Per Game */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>

              {/* Career Totals */}
              <div style={{ background: '#fff', border: '1px solid #DDE2EC', borderRadius: '12px', padding: '24px' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: '#8892A4', margin: '0 0 18px',
                }}>Career Totals</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Points',   abbr: 'PTS', val: totals.points,   color: '#1A5CFF' },
                    { label: 'Assists',  abbr: 'AST', val: totals.assists,  color: '#FF6B2B' },
                    { label: 'Rebounds', abbr: 'REB', val: totals.rebounds, color: '#06B6D4' },
                    { label: 'Steals',   abbr: 'STL', val: totals.steals,   color: '#10B981' },
                    { label: 'Blocks',   abbr: 'BLK', val: totals.blocks,   color: '#8B5CF6' },
                  ].map(({ abbr, val, color }) => (
                    <div key={abbr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.1em', color: '#8892A4',
                      }}>{abbr}</span>
                      <span style={{
                        fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                        color: '#0C1526',
                      }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per Game Averages */}
              <div style={{ background: '#fff', border: '1px solid #DDE2EC', borderRadius: '12px', padding: '24px' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  color: '#8892A4', margin: '0 0 18px',
                }}>Per Game</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { abbr: 'PTS', val: perGame.points   },
                    { abbr: 'AST', val: perGame.assists  },
                    { abbr: 'REB', val: perGame.rebounds },
                    { abbr: 'STL', val: perGame.steals   },
                    { abbr: 'BLK', val: perGame.blocks   },
                  ].map(({ abbr, val }) => (
                    <div key={abbr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.1em', color: '#8892A4',
                      }}>{abbr}</span>
                      <span style={{
                        fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                        color: '#0C1526',
                      }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance over time */}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: '#8892A4', margin: '0 0 14px',
            }}>Performance Over Time</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '14px',
              marginBottom: '56px',
            }}>
              {STAT_CHARTS.map(({ key, label, color }) => (
                <PublicBarChart key={key} data={stats} statKey={key} label={label} color={color} />
              ))}
            </div>
          </>
        ) : (
          <div style={{
            background: '#fff', border: '1px solid #DDE2EC', borderRadius: '12px',
            padding: '64px 32px', textAlign: 'center', marginBottom: '48px',
          }}>
            <p style={{ color: '#8892A4', fontFamily: 'var(--font-body)' }}>No stats logged yet — check back soon.</p>
          </div>
        )}

        {/* Powered by StatDrop */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          paddingTop: '24px', borderTop: '1px solid #DDE2EC',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8892A4',
          }}>Powered by</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 800,
            letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1A5CFF',
          }}>StatDrop</span>
        </div>
      </div>
    </div>
  )
}
