import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function CoachRoute({ children }) {
  const { user, playerProfile } = useAuth()
  const location = useLocation()

  if (user === undefined || (user && playerProfile === undefined)) return null

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (playerProfile) return <Navigate to={`/player/${playerProfile.id}`} replace />

  return children
}
