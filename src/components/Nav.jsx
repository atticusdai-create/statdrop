import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Nav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, playerProfile, signOut } = useAuth()
  const isHome = pathname === '/'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(244,246,249,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Link to="/" style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '22px',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        color: 'var(--text)',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
      }}>
        Stat<span style={{ color: 'var(--accent)' }}>Drop</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user && playerProfile !== undefined && (
          playerProfile ? (
            <>
              <Link to={`/player/${playerProfile.id}`} className="btn-ghost" style={{ padding: '7px 16px', fontSize: '14px' }}>
                My Profile
              </Link>
              {playerProfile.team_id && (
                <Link to={`/team/${playerProfile.team_id}`} className="btn-ghost" style={{ padding: '7px 16px', fontSize: '14px' }}>
                  My Team
                </Link>
              )}
            </>
          ) : (
            <Link to="/dashboard" className="btn-ghost" style={{ padding: '7px 16px', fontSize: '14px' }}>
              My Teams
            </Link>
          )
        )}

        {/* Only render auth controls once auth has resolved */}
        {user !== undefined && (
          user ? (
            <button
              onClick={handleSignOut}
              className="btn-ghost"
              style={{ padding: '7px 16px', fontSize: '14px' }}
            >
              Log Out
            </button>
          ) : (
            <>
              <Link to="/login" className="btn-ghost" style={{ padding: '7px 16px', fontSize: '14px' }}>
                Log In
              </Link>
              <Link to="/signup" className="btn-primary" style={{ padding: '7px 16px', fontSize: '14px' }}>
                Sign Up
              </Link>
            </>
          )
        )}
      </div>
    </nav>
  )
}
