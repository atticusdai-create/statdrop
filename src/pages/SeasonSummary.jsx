import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function calcNetRating(r) {
  return (
    (r.points || 0) * 1 +
    (r.assists || 0) * 1.5 +
    (r.rebounds || 0) * 1.2 +
    (r.steals || 0) * 2 +
    (r.blocks || 0) * 2
  )
}

function calcStdDev(nums) {
  if (nums.length < 2) return null
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  return Math.sqrt(nums.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / nums.length)
}

function maxBy(arr, fn) {
  if (!arr.length) return null
  return arr.reduce((best, curr) => fn(curr) > fn(best) ? curr : best)
}

function minBy(arr, fn) {
  if (!arr.length) return null
  return arr.reduce((best, curr) => fn(curr) < fn(best) ? curr : best)
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlayerBadges({ player }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', margin: '8px 0 14px' }}>
      {player.jerseyNumber != null && (
        <span style={{
          fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700,
          color: 'var(--muted)', background: 'var(--ground)',
          border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px',
        }}>#{player.jerseyNumber}</span>
      )}
      {player.position && (
        <span style={{
          fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--muted)', background: 'var(--ground)',
          border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px',
        }}>{player.position}</span>
      )}
    </div>
  )
}

function AwardCard({ icon, category, player, value, valueLabel, valueColor = 'var(--text)', accentColor = '#F59E0B', children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ height: '3px', background: accentColor, flexShrink: 0 }} />
      <div style={{ padding: '20px 22px 22px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: accentColor,
          }}>{category}</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800,
          letterSpacing: '-0.01em', textTransform: 'uppercase',
          color: 'var(--text)', lineHeight: 1.1,
        }}>{player.name}</div>
        <PlayerBadges player={player} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontFamily: 'var(--font-data)', fontSize: '36px', fontWeight: 700,
            lineHeight: 1, color: valueColor,
          }}>{value}</span>
          {valueLabel && (
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '11px',
              color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>{valueLabel}</span>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function NoDataCard({ icon, category, reason }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: 0.45,
    }}>
      <div style={{ height: '3px', background: 'var(--border)' }} />
      <div style={{ padding: '20px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)',
          }}>{category}</span>
        </div>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
          {reason}
        </p>
      </div>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700,
      letterSpacing: '0.15em', textTransform: 'uppercase',
      color: 'var(--muted)', margin: '0 0 18px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <span>{children}</span>
      <span style={{ flex: 1, height: '1px', background: 'var(--border)', display: 'block' }} />
    </h2>
  )
}

export default function SeasonSummary() {
  const { id } = useParams()
  const [team, setTeam] = useState(null)
  const [playerData, setPlayerData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: teamData, error: teamErr }, { data: stats, error: statsErr }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', id).single(),
        supabase
          .from('game_stats')
          .select('*, players(name, last_name, position, jersey_number)')
          .eq('team_id', id)
          .order('game_date', { ascending: true }),
      ])
      if (teamErr || !teamData) { setError('Team not found.'); setLoading(false); return }
      if (statsErr) { setError(statsErr.message); setLoading(false); return }
      setTeam(teamData)

      const byPlayer = {}
      for (const s of (stats || [])) {
        const pid = s.player_id
        if (!byPlayer[pid]) byPlayer[pid] = {
          playerId: pid,
          name: s.players?.name || 'Unknown',
          position: s.players?.position || '',
          jerseyNumber: s.players?.jersey_number ?? null,
          records: [],
        }
        byPlayer[pid].records.push(s)
      }

      setPlayerData(Object.values(byPlayer).filter(p => p.records.length > 0))
      setLoading(false)
    }
    load()
  }, [id])

  const summary = useMemo(() => {
    if (!playerData.length) return null

    const players = playerData.map(p => {
      const { records } = p
      const games = records.length
      // records are already ordered by game_date ascending from the query
      const ratings = records.map(calcNetRating)
      const totalRating = ratings.reduce((a, b) => a + b, 0)

      return {
        ...p,
        games,
        points:   records.reduce((s, r) => s + (r.points || 0), 0),
        assists:  records.reduce((s, r) => s + (r.assists || 0), 0),
        rebounds: records.reduce((s, r) => s + (r.rebounds || 0), 0),
        steals:   records.reduce((s, r) => s + (r.steals || 0), 0),
        blocks:   records.reduce((s, r) => s + (r.blocks || 0), 0),
        avg_net_rating: games > 0 ? +(totalRating / games).toFixed(1) : 0,
        ratings,
        improvement: games >= 2 ? +(ratings[ratings.length - 1] - ratings[0]).toFixed(1) : null,
        stdDev: calcStdDev(ratings),
      }
    })

    const leaders = {
      points:   maxBy(players, p => p.points),
      assists:  maxBy(players, p => p.assists),
      rebounds: maxBy(players, p => p.rebounds),
      steals:   maxBy(players, p => p.steals),
      blocks:   maxBy(players, p => p.blocks),
      rating:   maxBy(players, p => p.avg_net_rating),
    }

    const multiGame = players.filter(p => p.games >= 2)
    const mostImproved = multiGame.length > 0 ? maxBy(multiGame, p => p.improvement) : null
    const mostConsistent = multiGame.length > 0 ? minBy(multiGame, p => p.stdDev) : null

    let bestGame = null
    for (const p of players) {
      for (const r of p.records) {
        const rating = calcNetRating(r)
        if (!bestGame || rating > bestGame.rating) {
          bestGame = { rating: +rating.toFixed(1), player: p, record: r }
        }
      }
    }

    const allRecords = playerData.flatMap(p => p.records)
    const teamTotals = {
      games:    new Set(allRecords.map(r => r.game_date)).size,
      points:   allRecords.reduce((s, r) => s + (r.points || 0), 0),
      assists:  allRecords.reduce((s, r) => s + (r.assists || 0), 0),
      rebounds: allRecords.reduce((s, r) => s + (r.rebounds || 0), 0),
      steals:   allRecords.reduce((s, r) => s + (r.steals || 0), 0),
      blocks:   allRecords.reduce((s, r) => s + (r.blocks || 0), 0),
    }

    return { players, leaders, mostImproved, mostConsistent, bestGame, teamTotals }
  }, [playerData])

  if (loading) return <LoadState />
  if (error) return <ErrState msg={error} teamId={id} />
  if (!summary) return <EmptyState teamId={id} />

  const { players, leaders, mostImproved, mostConsistent, bestGame, teamTotals } = summary
  const sortedPlayers = [...players].sort((a, b) => b.avg_net_rating - a.avg_net_rating)

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0C1526 0%, #1A2744 55%, #0C1526 100%)',
        padding: 'clamp(40px, 8vw, 72px) 24px 52px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: '#F59E0B', margin: '0 0 14px',
        }}>Season in Review</p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 10vw, 72px)',
          fontWeight: 800, lineHeight: 0.92,
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          color: '#FFFFFF', margin: '0 0 28px',
        }}>{team.name}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {[
            { label: 'Games', value: teamTotals.games },
            { label: 'Players', value: players.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-data)', fontSize: '32px', fontWeight: 700,
                color: '#FFFFFF', lineHeight: 1,
              }}>{value}</div>
              <div style={{
                fontFamily: 'var(--font-data)', fontSize: '10px',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)', marginTop: '4px',
              }}>{label}</div>
            </div>
          ))}
        </div>
        <Link
          to={`/team/${id}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '32px',
            fontFamily: 'var(--font-data)', fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
            textDecoration: 'none',
            letterSpacing: '0.05em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          ← Back to Leaderboard
        </Link>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Team Season Totals */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHeading>Team Season Totals</SectionHeading>
          <div className="card" style={{ padding: '8px 16px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            }}>
              {[
                { label: 'Games',    value: teamTotals.games },
                { label: 'Points',   value: teamTotals.points.toLocaleString() },
                { label: 'Assists',  value: teamTotals.assists.toLocaleString() },
                { label: 'Rebounds', value: teamTotals.rebounds.toLocaleString() },
                { label: 'Steals',   value: teamTotals.steals.toLocaleString() },
                { label: 'Blocks',   value: teamTotals.blocks.toLocaleString() },
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{
                  textAlign: 'center',
                  padding: '20px 8px',
                  borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-data)', fontSize: '26px', fontWeight: 700,
                    color: 'var(--text)', lineHeight: 1,
                  }}>{value}</div>
                  <div style={{
                    fontFamily: 'var(--font-data)', fontSize: '10px',
                    color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginTop: '5px',
                  }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Category Leaders */}
        <section style={{ marginBottom: '40px' }}>
          <SectionHeading>Category Leaders</SectionHeading>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
            gap: '14px',
          }}>
            {leaders.points && (
              <AwardCard icon="🏀" category="Points Leader" player={leaders.points}
                value={leaders.points.points} valueLabel="total pts" />
            )}
            {leaders.assists && (
              <AwardCard icon="🎯" category="Assists Leader" player={leaders.assists}
                value={leaders.assists.assists} valueLabel="total ast" />
            )}
            {leaders.rebounds && (
              <AwardCard icon="💪" category="Rebounds Leader" player={leaders.rebounds}
                value={leaders.rebounds.rebounds} valueLabel="total reb" />
            )}
            {leaders.steals && (
              <AwardCard icon="🔒" category="Steals Leader" player={leaders.steals}
                value={leaders.steals.steals} valueLabel="total stl" />
            )}
            {leaders.blocks && (
              <AwardCard icon="🚫" category="Blocks Leader" player={leaders.blocks}
                value={leaders.blocks.blocks} valueLabel="total blk" />
            )}
            {leaders.rating && (
              <AwardCard icon="⭐" category="StatDrop Rating Leader" player={leaders.rating}
                value={leaders.rating.avg_net_rating} valueLabel="avg rating"
                valueColor="#E11D48" />
            )}
          </div>
        </section>

        {/* Special Awards */}
        <section style={{ marginBottom: '52px' }}>
          <SectionHeading>Special Awards</SectionHeading>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
            gap: '14px',
          }}>
            {/* Most Improved */}
            {mostImproved ? (
              <AwardCard
                icon="📈" category="Most Improved" player={mostImproved}
                value={mostImproved.improvement > 0 ? `+${mostImproved.improvement}` : String(mostImproved.improvement)}
                valueLabel="rating pts"
                valueColor={mostImproved.improvement > 0 ? '#10B981' : 'var(--muted)'}
                accentColor="#10B981"
              >
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '8px 0 0', fontFamily: 'var(--font-data)' }}>
                  First game → last game StatDrop Rating
                </p>
              </AwardCard>
            ) : (
              <NoDataCard icon="📈" category="Most Improved" reason="Needs 2+ games per player" />
            )}

            {/* Most Consistent */}
            {mostConsistent ? (
              <AwardCard
                icon="🎯" category="Most Consistent" player={mostConsistent}
                value={`±${mostConsistent.stdDev.toFixed(1)}`}
                valueLabel="std deviation"
                valueColor="var(--accent)"
                accentColor="var(--accent)"
              >
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '8px 0 0', fontFamily: 'var(--font-data)' }}>
                  Lowest variance in StatDrop Rating
                </p>
              </AwardCard>
            ) : (
              <NoDataCard icon="🎯" category="Most Consistent" reason="Needs 2+ games per player" />
            )}

            {/* Best Single Game */}
            {bestGame && (
              <AwardCard
                icon="💥" category="Best Single Game" player={bestGame.player}
                value={bestGame.rating} valueLabel="rating"
                valueColor="#E11D48"
              >
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['points', 'assists', 'rebounds', 'steals', 'blocks'].map(stat => {
                    const val = bestGame.record[stat] || 0
                    if (!val) return null
                    return (
                      <span key={stat} style={{
                        fontFamily: 'var(--font-data)', fontSize: '11px',
                        color: 'var(--muted)', background: 'var(--ground)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px', padding: '2px 6px',
                      }}>
                        {val} {stat.slice(0, 3).toUpperCase()}
                      </span>
                    )
                  })}
                </div>
                {bestGame.record.game_date && (
                  <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '8px 0 0', fontFamily: 'var(--font-data)' }}>
                    {fmtDate(bestGame.record.game_date)}
                  </p>
                )}
              </AwardCard>
            )}
          </div>
        </section>

        {/* Player Season Averages */}
        <section>
          <SectionHeading>Player Season Averages</SectionHeading>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {[
                      { label: '#',          align: 'left' },
                      { label: 'Player',     align: 'left' },
                      { label: 'GP',         align: 'right' },
                      { label: 'PPG',        align: 'right' },
                      { label: 'APG',        align: 'right' },
                      { label: 'RPG',        align: 'right' },
                      { label: 'SPG',        align: 'right' },
                      { label: 'BPG',        align: 'right' },
                      { label: 'Avg Rating', align: 'right', highlight: true },
                    ].map(({ label, align, highlight }) => (
                      <th key={label} style={{
                        padding: '12px 14px',
                        textAlign: align,
                        fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: highlight ? '#E11D48' : 'var(--muted)',
                        whiteSpace: 'nowrap',
                      }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p, i) => (
                    <tr
                      key={p.playerId}
                      style={{ borderBottom: i < sortedPlayers.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <td style={{ padding: '14px 14px', width: '40px' }}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: i === 0 ? '#F59E0B' : 'var(--ground)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
                          color: i === 0 ? '#FFFFFF' : 'var(--muted)',
                        }}>
                          {i === 0 ? '★' : i + 1}
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {p.jerseyNumber != null && (
                            <span style={{
                              fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 700,
                              color: 'var(--muted)', background: 'var(--ground)',
                              border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 5px',
                            }}>#{p.jerseyNumber}</span>
                          )}
                          <Link
                            to={`/player/${p.playerId}`}
                            style={{ fontWeight: 500, fontSize: '15px', color: 'var(--text)', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
                          >{p.name}</Link>
                          {p.position && (
                            <span style={{
                              fontFamily: 'var(--font-data)', fontSize: '10px', fontWeight: 700,
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                              color: 'var(--muted)', background: 'var(--ground)',
                              border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px',
                            }}>{p.position}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{p.games}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{(p.points / p.games).toFixed(1)}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{(p.assists / p.games).toFixed(1)}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{(p.rebounds / p.games).toFixed(1)}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{(p.steals / p.games).toFixed(1)}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--text)' }}>{(p.blocks / p.games).toFixed(1)}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: '14px', fontWeight: 700, color: '#E11D48' }}>
                          {p.avg_net_rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              fontSize: '11px', color: 'var(--muted)',
              fontFamily: 'var(--font-data)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Per-game averages · Ranked by Avg StatDrop Rating</span>
              <span style={{ color: '#E11D48', fontWeight: 700, letterSpacing: '0.05em' }}>StatDrop</span>
            </div>
          </div>
        </section>

        {/* Watermark */}
        <div style={{ textAlign: 'center', marginTop: '56px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.25em', textTransform: 'uppercase',
            color: 'var(--border)', margin: 0,
          }}>Generated by StatDrop</p>
        </div>
      </div>
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

function ErrState({ msg, teamId }) {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px' }}>
      <p style={{ color: '#E53E3E', fontSize: '15px' }}>{msg}</p>
      <Link to={`/team/${teamId}`} className="btn-ghost" style={{ marginTop: '20px', display: 'inline-flex' }}>Back to Leaderboard</Link>
    </div>
  )
}

function EmptyState({ teamId }) {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px' }}>
      <p style={{ color: 'var(--muted)', fontSize: '15px' }}>No stats logged yet.</p>
      <Link to={`/team/${teamId}`} className="btn-ghost" style={{ marginTop: '20px', display: 'inline-flex' }}>Back to Leaderboard</Link>
    </div>
  )
}
