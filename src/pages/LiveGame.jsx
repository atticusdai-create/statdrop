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
  { key: 'blocks',   words: ['block', 'blocked', 'blocks', 'reject', 'rejected', 'rejection', 'swat', 'swatted', 'blocked the shot', 'blocked it', 'sent it back', 'denied', 'stuffed', 'goaltended'] },
  { key: 'steals',   words: ['steal', 'stole', 'steals', 'stolen', 'rip', 'ripped', 'stripped', 'picked off', 'took it', 'picked it off', 'picked', 'deflected', 'poked away', 'got a hand on'] },
  { key: 'rebounds', words: ['rebound', 'rebounded', 'rebounds', 'board', 'boards', 'glass', 'grabbed', 'got a rebound', 'pulled down', 'hauled in', 'snatched', 'boxed out', 'offensive board', 'defensive board', 'tip', 'tipped'] },
  { key: 'assists',  words: ['assist', 'assisted', 'assists', 'pass', 'passed', 'dish', 'dished', 'feed', 'fed', 'dime', 'set up', 'helper', 'with the assist', 'found', 'threaded', 'hit him', 'hit her', 'connected', 'dropped off', 'kicked out', 'dished it', 'hockey assist'] },
  { key: 'points',   words: ['score', 'scored', 'basket', 'bucket', 'buckets', 'layup', 'dunk', 'dunked', 'shot', 'made', 'makes', 'hit', 'points', 'pts', 'drain', 'drains', 'money', 'trey', 'three', 'triple', 'downtown', 'drove and scored', 'knocked down', 'drilled', 'nailed', 'dropped', 'put in', 'put it in', 'and one', 'converted', 'finished'] },
]

const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }

function wordsToJerseyNum(words, startIdx) {
  const ones = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7,
    eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13,
    fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
  }
  const tens = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 }
  const w = words[startIdx]
  if (!w) return null
  if (w in ones) return { num: ones[w], endIdx: startIdx }
  if (w in tens) {
    const next = words[startIdx + 1]
    if (next && next in ones && ones[next] > 0) return { num: tens[w] + ones[next], endIdx: startIdx + 1 }
    return { num: tens[w], endIdx: startIdx }
  }
  return null
}

function parseVoiceLocally(transcript, players) {
  const t = transcript.toLowerCase()
  const words = t.split(/\W+/).filter(Boolean)
  console.log('[voice] words:', words)
  console.log('[voice] player names to match:', players.map(p => p.name))

  let player = null
  let jerseyWordStart = -1
  let jerseyWordEnd = -1

  // "number 23 ..." or "number twenty three ..." — explicit jersey number prefix
  const numberKeywordIdx = words.indexOf('number')
  if (numberKeywordIdx >= 0 && numberKeywordIdx < words.length - 1) {
    const nextIdx = numberKeywordIdx + 1
    const num = parseInt(words[nextIdx], 10)
    if (!isNaN(num)) {
      const jerseyMatch = players.find(p => Number(p.jersey_number) === num)
      if (jerseyMatch) { console.log(`[voice] jersey# converted: ${num} → matched player: ${jerseyMatch.name}`); player = jerseyMatch; jerseyWordStart = nextIdx; jerseyWordEnd = nextIdx }
    }
    if (!player) {
      const parsed = wordsToJerseyNum(words, nextIdx)
      if (parsed) {
        const jerseyMatch = players.find(p => Number(p.jersey_number) === parsed.num)
        if (jerseyMatch) { console.log(`[voice] jersey# converted: ${parsed.num} → matched player: ${jerseyMatch.name}`); player = jerseyMatch; jerseyWordStart = nextIdx; jerseyWordEnd = parsed.endIdx }
      }
    }
  }
  // Scan every word for a jersey number match (digit or word-form)
  if (!player) {
    for (let i = 0; i < words.length; i++) {
      if (/^\d+$/.test(words[i])) {
        const num = parseInt(words[i], 10)
        const jerseyMatch = players.find(p => Number(p.jersey_number) === num)
        if (jerseyMatch) { console.log(`[voice] jersey# converted: ${num} → matched player: ${jerseyMatch.name}`); player = jerseyMatch; jerseyWordStart = i; jerseyWordEnd = i; break }
      } else {
        const parsed = wordsToJerseyNum(words, i)
        if (parsed) {
          const jerseyMatch = players.find(p => Number(p.jersey_number) === parsed.num)
          if (jerseyMatch) { console.log(`[voice] jersey# converted: ${parsed.num} → matched player: ${jerseyMatch.name}`); player = jerseyMatch; jerseyWordStart = i; jerseyWordEnd = parsed.endIdx; break }
        }
      }
    }
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
    if (i >= jerseyWordStart && i <= jerseyWordEnd) continue
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

  const [pttListening, setPttListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastEntry, setLastEntry] = useState(null)

  const totalsRef = useRef({})
  const recordIds = useRef({})
  const pendingRef = useRef({})
  const savingFlags = useRef({})
  const recognitionRef = useRef(null)
  const micPermittedRef = useRef(false)
  const voiceActiveRef = useRef(false)
  const audioUnlockedRef = useRef(false)
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

  function handleTap(playerId, statKey, amount = 1, btnKey = null) {
    const cur = totalsRef.current[playerId] || { ...ZERO }
    const next = { ...cur, [statKey]: Math.max(0, cur[statKey] + amount) }
    totalsRef.current[playerId] = next
    pendingRef.current[playerId] = next
    setPlayerTotals(prev => ({ ...prev, [playerId]: next }))

    setFlash(prev => ({ ...prev, [playerId]: { stat: statKey, btn: btnKey } }))
    setTimeout(() => {
      setFlash(prev => prev[playerId]?.btn === btnKey ? { ...prev, [playerId]: null } : prev)
    }, 220)

    if (!savingFlags.current[playerId]) runSaveLoop(playerId)
  }

  function subtractStat(playerId, statKey) {
    handleTap(playerId, statKey, -1, `${statKey}-`)
  }

  function logStat(playerId, statKey, amount = 1) {
    const btnKey = statKey === 'points' ? `pts+${amount}` : `${statKey}+`
    handleTap(playerId, statKey, amount, btnKey)
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

  function startRecognitionLoop() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || !voiceActiveRef.current) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = e => {
      const t = e.results[0][0].transcript.trim()
      console.log('[voice] transcript:', JSON.stringify(t))
      setLiveTranscript(t)
      const match = parseVoiceLocally(t, playersRef.current)
      if (match) {
        logStat(match.player.id, match.statKey, match.amount)
        setTimeout(() => setLiveTranscript(''), 1500)
      } else {
        setLiveTranscript("Didn't catch that…")
        setTimeout(() => setLiveTranscript(''), 2000)
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      if (!voiceActiveRef.current) return
      startRecognitionLoop()
    }

    recognition.onerror = e => {
      if (e.error === 'aborted') return
      console.error('Speech recognition error:', e.error)
      recognitionRef.current = null
      if (!voiceActiveRef.current) return
      startRecognitionLoop()
    }

    try {
      recognition.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      recognitionRef.current = null
      if (voiceActiveRef.current) setTimeout(() => startRecognitionLoop(), 200)
    }
  }

  async function handleVoiceToggle() {
    if (voiceActiveRef.current) {
      voiceActiveRef.current = false
      recognitionRef.current?.stop()
      setPttListening(false)
      setLiveTranscript('')
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input requires Chrome, Edge, or Safari.'); return }

    if (!micPermittedRef.current && navigator.mediaDevices?.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        micPermittedRef.current = true
      } catch {
        alert('Microphone access is required for voice input.')
        return
      }
    } else {
      micPermittedRef.current = true
    }

    // iOS Safari requires AudioContext to be created/resumed from a user gesture
    if (!audioUnlockedRef.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        await ctx.resume()
        ctx.close()
      } catch {}
      audioUnlockedRef.current = true
    }

    voiceActiveRef.current = true
    setPttListening(true)
    setLiveTranscript('')
    startRecognitionLoop()
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
    voiceActiveRef.current = false
    recognitionRef.current?.stop()
    setPttListening(false)
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
          onClick={handleVoiceToggle}
          style={{
            width: '100%', marginBottom: '8px',
            padding: '24px 14px', borderRadius: '14px',
            border: `2px solid ${pttListening ? '#16A34A' : 'var(--border)'}`,
            background: pttListening ? 'rgba(22,163,74,0.12)' : 'var(--ground)',
            color: pttListening ? '#16A34A' : 'var(--text)',
            fontFamily: 'var(--font-display)',
            fontSize: '16px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s, color 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            lineHeight: 1,
            userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >
          {pttListening ? (
            <>
              <span style={{
                display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%',
                background: '#16A34A', flexShrink: 0,
                animation: 'voicePulse 0.8s ease-in-out infinite',
              }} />
              Listening…
            </>
          ) : (
            <>
              <span style={{ fontSize: '22px', lineHeight: 1 }}>🎙</span>
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

        {/* Row 4: transcript shown briefly after release */}
        {!!liveTranscript && (
          <div style={{
            marginTop: '8px', padding: '8px 14px',
            background: 'rgba(225,29,72,0.05)', borderRadius: '8px',
            border: '1px solid rgba(225,29,72,0.18)',
            minHeight: '32px',
          }}>
            <span style={{
              fontFamily: 'var(--font-data)', fontSize: '13px',
              color: 'var(--text)',
            }}>
              {liveTranscript}
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
              color: 'var(--muted)', margin: '0 0 6px',
            }}>
              Voice — use the player's name or jersey number
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 8px', marginBottom: '8px' }}>
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
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--muted)', margin: '0 0 6px',
            }}>
              Or use "number [#]"
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 8px' }}>
              {[
                'number 23 scored',
                'number 5 got a rebound',
                'number 14 stole the ball',
                'number 2 blocked it',
                'number 23 with the assist',
                'number 5 drove and scored',
                'number 14 picked it off',
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
                    background: playerFlash?.stat === key ? bg : 'var(--ground)',
                    borderRadius: '6px', transition: 'background 0.12s',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700,
                      color: playerFlash?.stat === key ? color : 'var(--text)',
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
                        border: `1.5px solid ${playerFlash?.btn === `pts+${amt}` ? '#1A5CFF' : 'var(--border)'}`,
                        background: playerFlash?.btn === `pts+${amt}` ? '#1A5CFF' : 'transparent',
                        color: playerFlash?.btn === `pts+${amt}` ? '#fff' : '#1A5CFF',
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
                          border: `1.5px solid ${playerFlash?.btn === `${key}+` ? color : 'var(--border)'}`,
                          background: playerFlash?.btn === `${key}+` ? color : 'transparent',
                          color: playerFlash?.btn === `${key}+` ? '#fff' : color,
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
