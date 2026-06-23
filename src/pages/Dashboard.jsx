import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    supabase
      .from('teams')
      .select('id, name, invite_code, created_at')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTeams(data || [])
        setLoading(false)
      })
  }, [user])

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', confirmDelete.id)
      .eq('coach_id', user.id)
    if (!error) {
      setTeams(prev => prev.filter(t => t.id !== confirmDelete.id))
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '60px 24px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: '40px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--accent)', marginBottom: '8px', margin: '0 0 8px',
          }}>Your teams</p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 7vw, 52px)',
            fontWeight: 800, lineHeight: 0.95,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            color: 'var(--text)', margin: 0,
          }}>Dashboard</h1>
        </div>
        <Link to="/create" className="btn-primary" style={{ fontSize: '16px', padding: '10px 22px' }}>
          + New Team
        </Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : teams.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '24px', fontSize: '15px' }}>
            No teams yet. Create your first squad to get started.
          </p>
          <Link to="/create" className="btn-primary">Create a Team</Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '2px',
        }}>
          {teams.map(team => (
            <div
              key={team.id}
              className="card"
              style={{
                padding: '28px', height: '100%',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                borderRadius: '0', cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => navigate(`/team/${team.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(team) }}
                title="Delete team"
                style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', padding: '4px 7px', borderRadius: '4px',
                  fontSize: '13px', lineHeight: 1,
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.background = 'none'
                }}
              >
                ✕
              </button>
              <div style={{
                fontFamily: 'var(--font-data)', fontSize: '11px',
                color: 'var(--accent)', marginBottom: '8px',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Basketball</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '26px',
                fontWeight: 800, letterSpacing: '-0.01em',
                textTransform: 'uppercase', color: 'var(--text)',
                marginBottom: '20px', lineHeight: 1.1,
              }}>{team.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}>Invite</span>
                <span className="stat-chip">{team.invite_code}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => { if (!deleting) setConfirmDelete(null) }}
        >
          <div
            className="card"
            style={{
              padding: '36px', maxWidth: '380px', width: '90%',
              borderRadius: '8px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '22px',
              fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '-0.01em', color: 'var(--text)',
              margin: '0 0 12px',
            }}>Delete Team?</h2>
            <p style={{
              color: 'var(--muted)', fontSize: '14px',
              margin: '0 0 28px', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text)' }}>{confirmDelete.name}</strong> and all
              its players and stats will be permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                style={{
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  background: 'none', border: '1px solid var(--border)',
                  color: 'var(--muted)', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  background: '#ef4444', border: 'none',
                  color: '#fff', borderRadius: '6px', cursor: 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
