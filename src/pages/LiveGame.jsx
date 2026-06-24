import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const today = () => new Date().toISOString().split('T')[0]

const STATS = [
  { key: 'points',   label: 'PTS', color: '#1A5CFF', bg: 'rgba(26,92,255,0.13)' },
  { key: 'assists',  label: 'AST', color: '#FF6B2B', bg: 'rgba(255,107,43,0.13)' },
  { key: 'rebounds', label: 'REB', color: '#06B6D4', bg: 'rgba(6,182,212,0.13)' },
  { key: 'steals',   label: 'STL', color: '#10B981', bg: 'rgba(16,185,129,0.13)' },
  { key: 'blocks',   label: 'BLK', color: '#8B5CF6', bg: 'rgba(139,92,246,0.13)' },
]

const ZERO = { points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 }

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

const STAT_KEYWORDS = [
  { key: 'blocks',   words: ['block', 'blocked', 'blocks', 'reject', 'rejected', 'rejection', 'swat', 'swatted'] },
  { key: 'steals',   words: ['steal', 'stole', 'steals', 'stolen', 'rip', 'ripped', 'stripped', 'picked off', 'took it'] },
  { key: 'rebounds', words: ['rebound', 'rebounded', 'rebounds', 'board', 'boards', 'glass', 'grabbed'] },
  { key: 'assists',  words: ['assist', 'assisted', 'assists', 'pass', 'passed', 'dish', 'dished', 'feed', 'fed', 'dime', 'set up', 'helper'] },
  { key: 'points',   words: ['score', 'scored', 'basket', 'bucket', 'layup', 'dunk', 'shot', 'made', 'hit', 'points', 'pts', 'drain', 'drains', 'money', 'trey', 'three', 'triple', 'downtown'] },
]

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }

function parseVoiceLocally(transcript, players) {
  const t = transcript.toLowerCase()
  const words = t.split(/\W+/).filter(Boolean)
  console.log('[voice] words:', words)
  console.log('[voice] player names to match:', players.map(p => p.name))

  let player = null
  let jerseyWordIdx = -1

  // "number 23 ..." — explicit jersey number prefix
  const numberKeywordIdx = words.indexOf('number')
  if (numberKeywordIdx >= 0 && numberKeywordIdx < words.length - 1) {
    const num = parseInt(words[numberKeywordIdx + 1], 10)
    if (!isNaN(num)) {
      const jerseyMatch = players.find(p => Number(p.jersey_number) === num)
      if (jerseyMatch) { player = jerseyMatch; jerseyWordIdx = numberKeywordIdx + 1 }
    }
  }
  // Digit at the start of the utterance — "23 scored", "14 got the rebound"
  if (!player && words.length > 0 && /^\d+$/.test(words[0])) {
    const num = parseInt(words[0], 10)
    const jerseyMatch = players.find(p => Number(p.jersey_number) === num)
    if (jerseyMatch) { player = jerseyMatch; jerseyWordIdx = 0 }
  }

  // Fall back to name matching
  if (!player) {
    player = players.find(p => {
      const nameParts = p.name.toLowerCase().split(/\s+/)
      const matched = nameParts.some(namePart => {
        if (namePart.length <= 3) return words.includes(namePart)
        return words.some(w => w.length >= 3 && levenshtein(w, namePart) <= 1)
      })
      console.log(`[voice] checking "${p.name}" (parts: ${JSON.stringify(nameParts)}) →`, matched)
      return matched
    })
  }
  if (!player) return null

  // Match stat by keyword phrases/words
  let statKey = null
  for (const { key, words: kws } of STAT_KEYWORDS) {
    if (kws.some(kw => t.includes(kw))) { statKey = key; break }
  }
  if (!statKey) return null

  // Parse amount: digit (skip jersey number word) > number word
  let amount = null
  for (let i = 0; i < words.length; i++) {
    if (i === jerseyWordIdx) continue
    if (/^\d+$/.test(words[i])) { amount = parseInt(words[i], 10); break }
  }
  if (amount === null) {
    for (const [word, val] of Object.entries(NUM_WORDS)) {
      if (words.includes(word)) { amount = val; break }
    }
  }

  // Default amounts: 3 for three-pointer cues, 2 for other points, 1 for everything else
  if (statKey === 'points') {
    const isThree = ['three', 'trey', 'triple', 'downtown'].some(kw => t.includes(kw))
    amount = amount ?? (isThree ? 3 : 2)
  } else {
    amount = amount ?? 1
  }

  return { player, statKey, amount }
}

export default function LiveGame() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(searchParams.get('team') || '')
  const [gameStarted, setGameStarted] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [ended, setEnded] = useState(false)

  const [playerTotals, setPlayerTotals] = useState({})
  const [flash, setFlash] = useState({})
  const [savingSet, setSavingSet] = useState(new Set())

  const [voiceActive, setVoiceActive] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastEntry, setLastEntry] = useState(null)

  const totalsRef = useRef({})
  const recordIds = useRef({})
  const pendingRef = useRef({})
  const savingFlags = useRef({})
  const recognitionRef = useRef(null)
  const voiceActiveRef = useRef(false)
  const playersRef = useRef(players)
  const lastEntryTimerRef = useRef(null)

  useEffect(() => { playersRef.current = players }, [players])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@keyframes voicePulse{0%,100%{opacity:1}50%{opacity:0.3}}'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    return () => {
      voiceActiveRef.current = false
      recognitionRef.current?.stop()
      if (lastEntryTimerRef.current) clearTimeout(lastEntryTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('teams').select('id,name')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTeams(data || []))
  }, [user])

  useEffect(() => {
    if (!selectedTeam) { setPlayers([]); return }
    supabase.from('players').select('id,name,jersey_number')
      .eq('team_id', selectedTeam)
      .order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [selectedTeam])

  async function savePlayer(playerId, totals) {
    if (recordIds.current[playerId]) {
      await supabase.from('game_stats')
        .update({ ...totals })
        .eq('id', recordIds.current[playerId])
    } else {
      const { data, error } = await supabase.from('game_stats')
        .insert([{
          player_id: playerId,
          team_id: selectedTeam,
          game_date: today(),
          ...totals,
        }])
        .select()
        .single()
      if (!error && data) recordIds.current[playerId] = data.id
    }
  }

  async function runSaveLoop(playerId) {
    savingFlags.current[playerId] = true
    setSavingSet(prev => new Set([...prev, playerId]))
    try {
      while (pendingRef.current[playerId]) {
        const snap = pendingRef.current[playerId]
        delete pendingRef.current[playerId]
        await savePlayer(playerId, snap)
      }
    } catch (err) {
      console.error('Save failed for player', playerId, err)
    } finally {
      savingFlags.current[playerId] = false
      setSavingSet(prev => { const s = new Set(prev); s.delete(playerId); return s })
    }
  }

  function handleTap(playerId, statKey, amount = 1) {
    const cur = totalsRef.current[playerId] || { ...ZERO }
    const next = { ...cur, [statKey]: Math.max(0, cur[statKey] + amount) }
    totalsRef.current[playerId] = next
    pendingRef.current[playerId] = next
    setPlayerTotals(prev => ({ ...prev, [playerId]: next }))

    setFlash(prev => ({ ...prev, [playerId]: statKey }))
    setTimeout(() => {
      setFlash(prev => prev[playerId] === statKey ? { ...prev, [playerId]: null } : prev)
    }, 220)

    if (!savingFlags.current[playerId]) runSaveLoop(playerId)
  }

  function subtractStat(playerId, statKey) {
    handleTap(playerId, statKey, -1)
  }

  function logStat(playerId, statKey, amount = 1) {
    handleTap(playerId, statKey, amount)
    if (lastEntryTimerRef.current) clearTimeout(lastEntryTimerRef.current)
    const player = playersRef.current.find(p => p.id === playerId)
    const stat = STATS.find(s => s.key === statKey)
    setLastEntry({ playerId, statKey, amount, playerName: player?.name || '', statLabel: stat?.label, color: stat?.color })
    lastEntryTimerRef.current = setTimeout(() => setLastEntry(null), 5000)
  }

  function handleUndo() {
    if (!lastEntry) return
    if (lastEntryTimerRef.current) clearTimeout(lastEntryTimerRef.current)
    const { playerId, statKey, amount } = lastEntry
    const cur = totalsRef.current[playerId] || { ...ZERO }
    const next = { ...cur, [statKey]: Math.max(0, cur[statKey] - amount) }
    totalsRef.current[playerId] = next
    pendingRef.current[playerId] = next
    setPlayerTotals(prev => ({ ...prev, [playerId]: next }))
    if (!savingFlags.current[playerId]) runSaveLoop(playerId)
    setLastEntry(null)
  }

  function launchRecognition() {
    if (!voiceActiveRef.current) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = e => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        const t = final.trim()
        console.log('[voice] raw transcript:', JSON.stringify(t))
        setLiveTranscript(t)
        const match = parseVoiceLocally(t, playersRef.current)
        if (match) {
          logStat(match.player.id, match.statKey, match.amount)
          setTimeout(() => setLiveTranscript(''), 800)
        } else {
          setLiveTranscript("Didn't catch that…")
          setTimeout(() => setLiveTranscript(''), 1500)
        }
        recognition.stop()
      } else {
        setLiveTranscript(interim)
      }
    }

    recognition.onend = () => {
      if (voiceActiveRef.current) setTimeout(launchRecognition, 100)
    }

    recognition.onerror = e => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.error('Speech recognition error:', e.error)
      }
      // onend fires after onerror and will restart
    }

    try {
      recognition.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      if (voiceActiveRef.current) setTimeout(launchRecognition, 500)
    }
  }

  function startListening() {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      alert('Voice input requires Chrome, Edge, or Safari.')
      return
    }
    voiceActiveRef.current = true
    setVoiceActive(true)
    launchRecognition()
  }

  function stopListening() {
    voiceActiveRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setVoiceActive(false)
    setLiveTranscript('')
  }

  function startGame() {
    if (!selectedTeam) { setSetupError('Select a team.'); return }
    if (players.length === 0) { setSetupError('This team has no players yet.'); return }
    setSetupError('')
    recordIds.current = {}
    pendingRef.current = {}
    savingFlags.current = {}
    const init = {}
    players.forEach(p => {
      init[p.id] = { ...ZERO }
      totalsRef.current[p.id] = { ...ZERO }
    })
    setPlayerTotals(init)
    setFlash({})
    setSavingSet(new Set())
    setGameStarted(true)
  }

  function handleEndGame() {
    stopListening()
    setEnded(true)
    setTimeout(() => navigate(`/team/${selectedTeam}`), 1600)
  }

  const teamTotals = Object.values(playerTotals).reduce((acc, t) => {
    STATS.forEach(({ key }) => { acc[key] = (acc[key] || 0) + (t[key] || 0) })
    return acc
  }, {})

  const anyUnsaved = savingSet.size > 0

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>Sign in to use Live Mode.</p>
        <Link to="/login" className="btn-primary">Sign In</Link>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '72px', fontWeight: 800,
          color: 'var(--border)', textTransform: 'uppercase', letterSpacing: '-0.02em',
        }}>Hold up.</div>
        <p style={{ color: 'var(--muted)', marginTop: '16px', maxWidth: '360px', margin: '16px auto 0' }}>
          Live mode is for coaches. Create a team first.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '28px' }}>
          <Link to="/create" className="btn-primary">Create a Team</Link>
          <Link to="/" className="btn-ghost">Go Home</Link>
        </div>
      </div>
    )
  }

  if (ended) {
    const teamName = teams.find(t => t.id === selectedTeam)?.name || 'Team'
    return (
      <div style={{ textAlign: 'center', padding: '120px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '80px', fontWeight: 800,
          color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '-0.02em',
        }}>Game<br />Over.</div>
        <p style={{ color: 'var(--muted)', marginTop: '12px' }}>
          {teamName} · {teamTotals.points || 0} pts · {teamTotals.assists || 0} ast · {teamTotals.rebounds || 0} reb
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>Loading leaderboard…</p>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 24px' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: '#E11D48', marginBottom: '12px',
        }}>Live Mode</p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 7vw, 52px)',
          fontWeight: 800, lineHeight: 0.95,
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          color: 'var(--text)', margin: '0 0 40px',
        }}>Track<br />Live</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label" htmlFor="live-team">Team</label>
            <select
              id="live-team" className="field" value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              <option value="">Select a team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {selectedTeam && players.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <p className="label" style={{ marginBottom: '8px' }}>
                Tracking {players.length} player{players.length !== 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {players.map(p => (
                  <span key={p.id} style={{
                    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    background: 'var(--ground)', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '4px 10px', color: 'var(--text)',
                  }}>{p.name}</span>
                ))}
              </div>
            </div>
          )}

          {selectedTeam && players.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
              No players on this team yet.{' '}
              <Link to="/dashboard" style={{ color: 'var(--accent)' }}>Add players in dashboard.</Link>
            </p>
          )}

          {setupError && <p style={{ color: '#E53E3E', fontSize: '13px', margin: 0 }}>{setupError}</p>}

          <button
            className="btn-primary" onClick={startGame}
            style={{ width: '100%', fontSize: '16px', padding: '14px' }}
          >
            Start Tracking
          </button>
        </div>
      </div>
    )
  }

  const teamName = teams.find(t => t.id === selectedTeam)?.name || ''

  return (
    <div style={{ background: 'var(--ground)', minHeight: '100svh' }}>

      {/* Undo toast */}
      {lastEntry && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 999,
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: '100px', padding: '8px 8px 8px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: lastEntry.color,
          }}>
            &#10003; {lastEntry.amount > 1 ? `${lastEntry.amount}× ` : ''}{lastEntry.statLabel} &mdash; {lastEntry.playerName}
          </span>
          <button
            onClick={handleUndo}
            style={{
              padding: '6px 14px', borderRadius: '100px',
              background: 'transparent', border: '1.5px solid var(--border)',
              color: 'var(--muted)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '10px 14px',
      }}>
        {/* Row 1: team name + save indicator + End Game */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
              background: '#E11D48', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(225,29,72,0.22)',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text)',
            }}>{teamName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '10px', letterSpacing: '0.05em',
              color: anyUnsaved ? '#FF6B2B' : '#10B981',
              transition: 'color 0.3s',
            }}>
              {anyUnsaved ? '● saving' : '● saved'}
            </span>
            <button
              onClick={handleEndGame}
              style={{
                padding: '7px 15px', borderRadius: '7px',
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--muted)', fontFamily: 'var(--font-display)',
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
            >
              End Game
            </button>
          </div>
        </div>

        {/* Row 2: voice toggle button */}
        <button
          onClick={voiceActive ? stopListening : startListening}
          style={{
            width: '100%', marginBottom: '8px',
            padding: '8px 14px', borderRadius: '8px',
            border: `1.5px solid ${voiceActive ? '#E11D48' : 'var(--border)'}`,
            background: voiceActive ? 'rgba(225,29,72,0.07)' : 'transparent',
            color: voiceActive ? '#E11D48' : 'var(--muted)',
            fontFamily: 'var(--font-display)',
            fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            lineHeight: 1,
          }}
        >
          {voiceActive ? (
            <>
              <span style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                background: '#E11D48', flexShrink: 0,
                animation: 'voicePulse 1s ease-in-out infinite',
              }} />
              Stop Listening
            </>
          ) : (
            <>
              <span style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--muted)', flexShrink: 0,
              }} />
              Start Listening
            </>
          )}
        </button>

        {/* Row 3: live team scoreboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '4px' }}>
          {STATS.map(({ key, label, color }) => (
            <div key={key} style={{
              textAlign: 'center', padding: '7px 2px',
              background: 'var(--ground)', borderRadius: '7px',
            }}>
              <div style={{
                fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                color, lineHeight: 1,
              }}>
                {teamTotals[key] || 0}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--muted)', marginTop: '2px',
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Row 4: live transcript (only when voice is active) */}
        {voiceActive && (
          <div style={{
            marginTop: '8px', padding: '7px 12px',
            background: 'rgba(225,29,72,0.05)', borderRadius: '7px',
            border: '1px solid rgba(225,29,72,0.18)',
            display: 'flex', alignItems: 'center', gap: '8px',
            minHeight: '30px',
          }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: '#E11D48', flexShrink: 0,
              animation: 'voicePulse 1s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '12px',
              color: liveTranscript ? 'var(--text)' : 'var(--muted)',
              fontStyle: liveTranscript ? 'normal' : 'italic',
            }}>
              {liveTranscript || 'Listening…'}
            </span>
          </div>
        )}
      </div>

      {/* Player cards */}
      <div style={{
        padding: '12px 12px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '10px',
        maxWidth: '1280px', margin: '0 auto',
      }}>
        {/* Voice command instructions */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '12px 16px',
          }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--muted)', margin: '0 0 8px',
            }}>
              Voice — say the player's name + what they did
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 8px' }}>
              {[
                '[name] just scored',
                'two points for [name]',
                '[name] drove and scored',
                '[name] got a rebound',
                '[name] stole the ball',
                '[name] blocked the shot',
                '[name] dished the assist',
              ].map(ex => (
                <span key={ex} style={{
                  fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--accent)',
                  background: 'var(--ground)', borderRadius: '5px', padding: '2px 7px',
                  border: '1px solid var(--border)',
                }}>
                  "{ex}"
                </span>
              ))}
            </div>
          </div>
        </div>

        {players.map(player => {
          const t = playerTotals[player.id] || ZERO
          const playerFlash = flash[player.id]
          const isSaving = savingSet.has(player.id)

          return (
            <div key={player.id} className="card" style={{ padding: '14px' }}>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '10px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 800,
                  letterSpacing: '-0.01em', textTransform: 'uppercase',
                  color: 'var(--text)', lineHeight: 1,
                }}>
                  {player.jersey_number != null && (
                    <span style={{ color: 'var(--muted)', fontWeight: 700, marginRight: '4px' }}>
                      #{player.jersey_number}
                    </span>
                  )}
                  {player.name.split(' ')[0]}
                </div>
                <span style={{
                  fontFamily: 'var(--font-data)', fontSize: '9px', letterSpacing: '0.05em',
                  color: isSaving ? '#FF6B2B' : 'transparent',
                  transition: 'color 0.2s',
                }}>●</span>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                gap: '4px', marginBottom: '8px',
              }}>
                {STATS.map(({ key, label, color, bg }) => (
                  <div key={key} style={{
                    textAlign: 'center', padding: '7px 2px',
                    background: playerFlash === key ? bg : 'var(--ground)',
                    borderRadius: '6px', transition: 'background 0.12s',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                      color: playerFlash === key ? color : 'var(--text)',
                      lineHeight: 1, transition: 'color 0.12s',
                    }}>
                      {t[key]}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'var(--muted)', marginTop: '1px',
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Points: +1, +2, +3, −PTS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {[1, 2, 3].map(amt => (
                    <button
                      key={amt}
                      onClick={() => logStat(player.id, 'points', amt)}
                      style={{
                        padding: '10px 2px', borderRadius: '7px',
                        border: `1.5px solid ${playerFlash === 'points' ? '#1A5CFF' : 'var(--border)'}`,
                        background: playerFlash === 'points' ? '#1A5CFF' : 'transparent',
                        color: playerFlash === 'points' ? '#fff' : '#1A5CFF',
                        fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 800,
                        letterSpacing: '0.03em', textTransform: 'uppercase', cursor: 'pointer',
                        transition: 'background 0.1s, color 0.08s, border-color 0.08s',
                        WebkitTapHighlightColor: 'transparent', userSelect: 'none', lineHeight: 1,
                      }}
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    onClick={() => subtractStat(player.id, 'points')}
                    style={{
                      padding: '10px 2px', borderRadius: '7px',
                      border: '1.5px solid var(--border)', background: 'transparent',
                      color: 'var(--muted)', fontFamily: 'var(--font-display)',
                      fontSize: '12px', fontWeight: 800, letterSpacing: '0.03em',
                      textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.1s',
                      WebkitTapHighlightColor: 'transparent', userSelect: 'none', lineHeight: 1,
                    }}
                  >
                    −PTS
                  </button>
                </div>
                {/* AST + REB row, then STL + BLK row — each as [+STAT][−STAT] pairs */}
                {[STATS.slice(1, 3), STATS.slice(3)].map((group, gi) => (
                  <div key={gi} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {group.flatMap(({ key, label, color }) => [
                      <button
                        key={`+${key}`}
                        onClick={() => logStat(player.id, key)}
                        style={{
                          padding: '10px 2px', borderRadius: '7px',
                          border: `1.5px solid ${playerFlash === key ? color : 'var(--border)'}`,
                          background: playerFlash === key ? color : 'transparent',
                          color: playerFlash === key ? '#fff' : color,
                          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 800,
                          letterSpacing: '0.03em', textTransform: 'uppercase', cursor: 'pointer',
                          transition: 'background 0.1s, color 0.08s, border-color 0.08s',
                          WebkitTapHighlightColor: 'transparent', userSelect: 'none', lineHeight: 1,
                        }}
                      >
                        +{label}
                      </button>,
                      <button
                        key={`-${key}`}
                        onClick={() => subtractStat(player.id, key)}
                        style={{
                          padding: '10px 2px', borderRadius: '7px',
                          border: '1.5px solid var(--border)', background: 'transparent',
                          color: 'var(--muted)', fontFamily: 'var(--font-display)',
                          fontSize: '12px', fontWeight: 800, letterSpacing: '0.03em',
                          textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.1s',
                          WebkitTapHighlightColor: 'transparent', userSelect: 'none', lineHeight: 1,
                        }}
                      >
                        −{label}
                      </button>,
                    ])}
                  </div>
                ))}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
