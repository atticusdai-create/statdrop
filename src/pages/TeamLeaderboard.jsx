import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const COLS = [
  { key: 'points',          label: 'PTS',  desc: 'Points per game' },
  { key: 'assists',         label: 'AST',  desc: 'Assists per game' },
  { key: 'rebounds',        label: 'REB',  desc: 'Rebounds per game' },
  { key: 'steals',          label: 'STL',  desc: 'Steals per game' },
  { key: 'blocks',          label: 'BLK',  desc: 'Blocks per game' },
  { key: 'shot_percentage', label: 'FG%',  desc: 'Field goal %' },
  { key: 'net_rating',      label: 'NET',  desc: 'Net rating per game' },
  { key: 'games',           label: 'GP',   desc: 'Games played' },
]

function calcNetRating(records) {
  if (!records.length) return 0
  const sum = records.reduce((s, r) =>
    s + (r.points * 1) + (r.assists * 1.5) + (r.rebounds * 1.2) + (r.steals * 2) + (r.blocks * 2) + (r.shot_percentage * 0.5), 0)
  return +(sum / records.length).toFixed(1)
}

function avg(arr, key) {
  if (!arr.length) return 0
  return arr.reduce((s, r) => s + (r[key] || 0), 0) / arr.length
}

function SortArrow({ dir }) {
  return (
    <span style={{ fontSize: '10px', opacity: 0.7 }}>
      {dir === 'desc' ? '▼' : '▲'}
    </span>
  )
}

export default function TeamLeaderboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [team, setTeam] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('points')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: teamData, error: teamErr }, { data: stats, error: statsErr }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', id).single(),
        supabase.from('game_stats').select('*, players(name)').eq('team_id', id),
      ])
      if (teamErr || !teamData) { setError('Team not found.'); setLoading(false); return }
      if (statsErr) { setError(statsErr.message); setLoading(false); return }
      setTeam(teamData)

      const byPlayer = {}
      for (const s of (stats || [])) {
        const pid = s.player_id
        if (!byPlayer[pid]) byPlayer[pid] = { playerId: pid, name: s.players?.name || 'Unknown', records: [] }
        byPlayer[pid].records.push(s)
      }

      const compiled = Object.values(byPlayer).map(({ playerId, name, records }) => ({
        playerId,
        name,
        games:           records.length,
        points:          +avg(records, 'points').toFixed(1),
        assists:         +avg(records, 'assists').toFixed(1),
        rebounds:        +avg(records, 'rebounds').toFixed(1),
        steals:          +avg(records, 'steals').toFixed(1),
        blocks:          +avg(records, 'blocks').toFixed(1),
        shot_percentage: +avg(records, 'shot_percentage').toFixed(1),
        net_rating:      calcNetRating(records),
      }))

      setRows(compiled)
      setLoading(false)
    }
    load()
  }, [id])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rows, sortKey, sortDir])

  const netRankings = useMemo(() =>
    [...rows].sort((a, b) => b.net_rating - a.net_rating),
    [rows]
  )

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return <LoadState />
  if (error)   return <ErrState msg={error} />

  const isCoach = !!user && user.id === team?.coach_id

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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            {isCoach && (
              <span style={{
                fontFamily: 'var(--font-data)', fontSize: '12px',
                color: 'var(--muted)', letterSpacing: '0.08em',
              }}>
                CODE: <strong style={{ color: 'var(--text)' }}>{team.invite_code}</strong>
              </span>
            )}
            {isCoach && (
              <Link to={`/live?team=${id}`} style={{
                padding: '8px 18px', fontSize: '14px',
                borderRadius: '8px', border: '1.5px solid #E11D48',
                color: '#E11D48', background: 'rgba(225,29,72,0.06)',
                fontFamily: 'var(--font-body)', fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}>
                ● Live
              </Link>
            )}
            {isCoach && (
              <Link to={`/log?team=${id}`} className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}>
                + Log Stats
              </Link>
            )}
          </div>
        </div>
      </div>

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
                          style={{ marginLeft: 'auto', color: col.key === 'net_rating' ? '#E11D48' : undefined }}
                        >
                          {col.label}
                          {sortKey === col.key && <SortArrow dir={sortDir} />}
                        </button>
                      </th>
                    ))}
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
                          <span style={{ fontWeight: 500, color: 'var(--text)', fontSize: '15px' }}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      {COLS.map(col => (
                        <td key={col.key} style={{ padding: '16px 12px', textAlign: 'right' }}>
                          <span style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: '14px',
                            color: col.key === 'net_rating'
                              ? '#E11D48'
                              : sortKey === col.key ? 'var(--accent)' : 'var(--text)',
                            fontWeight: (col.key === 'net_rating' || sortKey === col.key) ? 700 : 400,
                          }}>
                            {col.key === 'shot_percentage' ? `${row[col.key]}%` : row[col.key]}
                          </span>
                        </td>
                      ))}
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
              <span>{rows.length} player{rows.length !== 1 ? 's' : ''} · averages per game</span>
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
              }}>Net Rating Rankings</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                (PTS × 1) + (AST × 1.5) + (REB × 1.2) + (STL × 2) + (BLK × 2) + (FG% × 0.5) — per game
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
                  <Bar dataKey="net_rating" radius={[0, 4, 4, 0]} label={{
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
