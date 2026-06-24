import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Nav from './components/Nav'
import ProtectedRoute from './components/ProtectedRoute'
import CoachRoute from './components/CoachRoute'
import AddToHomeScreen from './components/AddToHomeScreen'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import TeamLeaderboard from './pages/TeamLeaderboard'
import StatLog from './pages/StatLog'
import PlayerProfile from './pages/PlayerProfile'
import PublicPlayerProfile from './pages/PublicPlayerProfile'
import CreateTeam from './pages/CreateTeam'
import JoinTeam from './pages/JoinTeam'
import LiveGame from './pages/LiveGame'

function AppLayout() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/public/')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      {!hideNav && <Nav />}
      <AddToHomeScreen />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<CoachRoute><Dashboard /></CoachRoute>} />
          <Route path="/create" element={<CoachRoute><CreateTeam /></CoachRoute>} />
          <Route path="/join" element={<JoinTeam />} />
          <Route path="/team/:id" element={<TeamLeaderboard />} />
          <Route path="/log" element={<CoachRoute><StatLog /></CoachRoute>} />
          <Route path="/player/:id" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
          <Route path="/public/player/:id" element={<PublicPlayerProfile />} />
          <Route path="/live" element={<CoachRoute><LiveGame /></CoachRoute>} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  )
}
