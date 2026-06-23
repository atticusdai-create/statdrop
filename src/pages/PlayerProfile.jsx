import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'

const STAT_CHARTS = [
  { key: 'points',          label: 'Points',          color: '#1A5CFF' },
  { key: 'assists',         label: 'Assists',         color: '#FF6B2B' },
  { key: 'rebounds',        label: 'Rebounds',        color: '#06B6D4' },
  { key: 'steals',          label: 'Steals',          color: '#10B981' },
  { key: 'blocks',          label: 'Blocks',          color: '#8B5CF6' },
  { key: 'net_rating',      label: 'Net Rating',      color: '#E11D48' },
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

function fmt(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label, unit, statKey }) {
  console.log('[CustomTooltip] active:', active, 'payload:', payload, 'label:', label)
  if (!active || !payload?.length) return null
  // payload[0].payload is always the raw data object; use statKey to read the real value
  const value = statKey
    ? (payload[0].payload?.[statKey] ?? payload[0].value)
    : payload[0].value
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '8px', padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--muted)' }}>{fmt(label)}</p>
      <p style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '18px', fontWeight: 700, color: payload[0].color }}>
        {value}{unit}
      </p>
    </div>
  )
}

function StatChart({ data, statKey, label, color }) {
  console.log('[StatChart]', label, 'keys:', data.length ? Object.keys(data[0]) : [], 'data:', data)
  const values = data.map(d => d[statKey])
  const max = Math.max(...values, 1)
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—'
  const last = values.length ? values[values.length - 1] : '—'
  const unit = ''
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
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '28px', fontWeight: 700, color,
            }}>{last}{unit}</span>
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
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '16px', color: 'var(--text)' }}>
            {avg}{unit}
          </span>
        </div>
      </div>

      {data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="game_date"
              tickFormatter={fmt}
              tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-body)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(max * 1.2)]}
              tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'var(--font-body)' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={(props) => <CustomTooltip {...props} unit={unit} statKey={statKey} />} />
            <Line
              type="monotone"
              dataKey={statKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: 'var(--surface)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{
          height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', fontSize: '13px',
        }}>
          Log at least 2 games to see the trend
        </div>
      )}
    </div>
  )
}

export default function PlayerProfile() {
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
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 8vw, 72px)',
          fontWeight: 800, lineHeight: 0.92,
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          color: 'var(--text)', margin: '0 0 28px',
        }}>{player.name}</h1>

        {/* Quick summary chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Games', val: totals.games },
            { label: 'Total PTS', val: totals.points },
            { label: 'Total AST', val: totals.assists },
            { label: 'Avg Net Rating per Game', val: totals.avgNetRating, highlight: true },
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
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>No stats logged for this player yet.</p>
          <Link to={`/log?team=${team?.id}`} className="btn-primary">Log First Game</Link>
        </div>
      ) : (
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
                  {[...stats].reverse().map((row, i) => (
                    <tr key={row.id} style={{ borderBottom: i < stats.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
    </div>
  )
}
