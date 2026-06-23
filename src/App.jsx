import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Nav from './components/Nav'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import TeamLeaderboard from './pages/TeamLeaderboard'
import StatLog from './pages/StatLog'
import PlayerProfile from './pages/PlayerProfile'
import CreateTeam from './pages/CreateTeam'
import JoinTeam from './pages/JoinTeam'
import LiveGame from './pages/LiveGame'

export default function App() {
  return (
    <AuthProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
        <Nav />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreateTeam /></ProtectedRoute>} />
            <Route path="/join" element={<JoinTeam />} />
            <Route path="/team/:id" element={<TeamLeaderboard />} />
            <Route path="/log" element={<ProtectedRoute><StatLog /></ProtectedRoute>} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/live" element={<ProtectedRoute><LiveGame /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}
