import React, { useState, useRef, useCallback } from 'react'

const GAMES = {
  baccarat: { name: 'BACCARAT', B: 'BANKER', P: 'PLAYER', T: 'TIE' },
  dragon:   { name: 'DRAGON TIGER', B: 'DRAGON', P: 'TIGER', T: 'TIE' }
}

const chipStyle = (type) => {
  const m = {
    B: { background:'#1f0508', borderColor:'#c8200a', color:'#e83020' },
    P: { background:'#05081f', borderColor:'#2050c8', color:'#4070e8' },
    T: { background:'#051f0a', borderColor:'#20a840', color:'#30b850' },
    X: { background:'#1a0510', borderColor:'#2d0a18', color:'#3a1020' }
  }
  return m[type] || m.X
}

function getStreak(results) {
  const nt = results.filter(r => r !== 'T')
  if (!nt.length) return { v: null, n: 0 }
  const last = nt[nt.length - 1]
  let n = 0
  for (let i = nt.length - 1; i >= 0; i--) { if (nt[i] === last) n++; else break }
  return { v: last, n }
}

function analyzePattern(results) {
  const nt = results.filter(r => r !== 'T')
  const ntN = nt.length
  if (ntN < 3) return { sug: null, conf: 0, reason: 'Input minimal 3 ronde', chips: [] }

  const cnt = { B: results.filter(r=>r==='B').length, P: results.filter(r=>r==='P').length }
  const bP = Math.round(cnt.B / ntN * 100)
  const pP = Math.round(cnt.P / ntN * 100)
  const sk = getStreak(results)
  const last4 = nt.slice(-4)
  const isChop = last4.length >= 4 && last4[0]!==last4[1] && last4[1]!==last4[2] && last4[2]!==last4[3]
  const isDbl  = last4.length >= 4 && last4[0]===last4[1] && last4[2]===last4[3] && last4[0]!==last4[2]
  const chops  = nt.reduce((a,c,i,ar) => i>0 && c!==ar[i-1] ? a+1 : a, 0)
  const cr     = ntN > 1 ? Math.round(chops/(ntN-1)*100) : 0

  let sug=null, conf=0, reason='', chips=[]

  if (sk.n >= 5) {
    sug = sk.v==='B' ? 'P' : 'B'; conf = 64
    reason = `Streak ${sk.n}x → kemungkinan berbalik`
    chips.push({ c:'gold', t:`STREAK ${sk.n}X SWITCH` })
  } else if (sk.n >= 3) {
    sug = sk.v; conf = 58
    reason = `Streak aktif ${sk.n}x → ikut momentum`
    chips.push({ c: sk.v==='B'?'red':'blue', t:`STREAK ${sk.n}X` })
  } else if (isChop) {
    sug = nt[nt.length-1]==='B' ? 'P' : 'B'; conf = 54
    reason = 'Pola bolak-balik terdeteksi'
    chips.push({ c:'gold', t:'CHOP PATTERN' })
  } else if (isDbl) {
    sug = nt[nt.length-1]; conf = 55
    reason = 'Pola double-double aktif'
    chips.push({ c:'gold', t:'DOUBLE PATTERN' })
  } else if (bP > pP + 12) {
    sug='B'; conf=53; reason=`Banker dominan ${bP}%`
    chips.push({ c:'red', t:'BANKER DOM' })
  } else if (pP > bP + 12) {
    sug='P'; conf=53; reason=`Player dominan ${pP}%`
    chips.push({ c:'blue', t:'PLAYER DOM' })
  } else {
    sug='B'; conf=49; reason='Distribusi seimbang'
    chips.push({ c:'grey', t:'SEIMBANG' })
  }

  if (cr > 65) chips.push({ c:'gold', t:'SHOE CHAOS' })
  else if (cr < 30 && sk.n >= 2) chips.push({ c:'green', t:'SHOE REPETITIF' })

  return { sug, conf, reason, chips, bP, pP, cr, sk }
}

export default function App() {
  const [gameKey, setGameKey] = useState('baccarat')
  const [results, setResults] = useState([])
  const [sesi, setSesi] = useState(1)
  const [aiText, setAiText] = useState('— Belum ada analisis —')
  const [aiLoading, setAiLoading] = useState(false)
  const [pressed, setPressed] = useState(null)
  const aiTimer = useRef(null)
  const game = GAMES[gameKey]

  const pat = analyzePattern(results)
  const cnt = { B: results.filter(r=>r==='B').length, P: results.filter(r=>r==='P').length, T: results.filter(r=>r==='T').length }
  const ntN = results.filter(r=>r!=='T').length
  const bP = ntN ? Math.round(cnt.B/ntN*100) : 0
  const pP = ntN ? Math.round(cnt.P/ntN*100) : 0
  const tP = results.length ? Math.round(cnt.T/results.length*100) : 0

  const callAI = useCallback(async (arr) => {
    setAiLoading(true)
    const nt = arr.filter(r=>r!=='T')
    const sk = getStreak(arr)
    const bPct = nt.length ? Math.round(arr.filter(r=>r==='B').length/nt.length*100) : 0
    const prompt = `Kamu adalah AI analis casino profesional kelas dunia.
Game: ${game.name}
Hasil 15 terakhir: ${arr.slice(-15).join('-')}
Total ronde: ${arr.length} | ${game.B}: ${arr.filter(r=>r==='B').length} (${bPct}%) | ${game.P}: ${arr.filter(r=>r==='P').length} (${100-bPct}%) | Tie: ${arr.filter(r=>r==='T').length}
Streak: ${sk.v ? (sk.v==='B'?game.B:sk.v==='P'?game.P:'Tie')+' '+sk.n+'x' : 'tidak ada'}

Analisis pola & berikan rekomendasi konkret ronde berikutnya. Max 2 kalimat, bahasa Indonesia, tegas dan profesional.`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      setAiText(data.text || 'Analisis tidak tersedia.')
    } catch {
      const sk2 = getStreak(arr)
      if (sk2.n >= 5) setAiText(`Streak ${sk2.v==='B'?game.B:game.P} ${sk2.n}x sangat panjang — sinyal kuat untuk switch sisi.`)
      else if (sk2.n >= 3) setAiText(`Momentum ${sk2.v==='B'?game.B:game.P} kuat ${sk2.n}x. Ikuti tren selama belum ada sinyal pembalikan.`)
      else if (bPct > 60) setAiText(`${game.B} mendominasi ${bPct}%. Shoe cenderung repetitif ke ${game.B}.`)
      else setAiText(`Distribusi seimbang. Amati 3-5 ronde berikutnya sebelum menaikkan taruhan.`)
    } finally { setAiLoading(false) }
  }, [gameKey])

  const addR = (r) => {
    setPressed(r); setTimeout(() => setPressed(null), 180)
    const next = [...results, r]
    setResults(next)
    clearTimeout(aiTimer.current)
    if (next.filter(x=>x!=='T').length >= 3) {
      aiTimer.current = setTimeout(() => callAI(next), 700)
    }
    saveData(next)
  }

  const undo = () => {
    if (!results.length) return
    const next = results.slice(0, -1)
    setResults(next)
    clearTimeout(aiTimer.current)
    if (next.filter(x=>x!=='T').length >= 3) aiTimer.current = setTimeout(() => callAI(next), 700)
    else setAiText('— Belum ada analisis —')
    saveData(next)
  }

  const newSesi = () => {
    setSesi(s => s+1); setResults([])
    setAiText('— Sesi baru dimulai —')
  }

  const switchGame = (key) => {
    setGameKey(key); setResults([])
    setAiText('— Belum ada analisis —')
  }

  const saveData = async (arr) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameKey, sesi, results: arr, date: new Date().toISOString() })
      })
    } catch {}
  }

  const predC = pat.sug ? chipStyle(pat.sug) : chipStyle('X')
  const confColor = pat.conf >= 60 ? '#20a840' : pat.conf >= 53 ? '#c8922a' : '#c8200a'

  const chipTagStyle = (c) => {
    const m = {
      red:  { background:'#1f0508', borderColor:'#c8200a', color:'#c8200a' },
      blue: { background:'#05081f', borderColor:'#2050c8', color:'#4070e8' },
      green:{ background:'#051f0a', borderColor:'#20a840', color:'#30b850' },
      gold: { background:'#1f1005', borderColor:'#c8922a', color:'#c8922a' },
      grey: { background:'#1a0510', borderColor:'#2d0a18', color:'#4a1a28' }
    }
    return { padding:'3px 9px', fontSize:10, border:'1px solid', fontFamily:'monospace', letterSpacing:0.5, whiteSpace:'nowrap', flexShrink:0, ...m[c] }
  }

  return (
    <div style={{ maxWidth:390, margin:'0 auto', background:'#09050a', minHeight:'100vh', fontFamily:"'Georgia',serif", display:'flex', flexDirection:'column' }}>

      {/* HEADER */}
      <div style={{ background:'#0f0610', borderBottom:'1px solid #2d0a18', padding:'13px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', border:'1.5px solid #c8922a', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:12, height:12, background:'#c8922a', transform:'rotate(45deg)' }}></div>
          </div>
          <span style={{ fontSize:17, color:'#c8922a', letterSpacing:2, fontStyle:'italic' }}>Royal Track</span>
        </div>
        <div style={{ background:'#1a0510', border:'1px solid #2d0a18', padding:'3px 10px', fontSize:10, color:'#6a2535', fontFamily:'monospace', letterSpacing:1 }}>
          SESI #{sesi} · RONDE {results.length}
        </div>
      </div>

      {/* GAME TABS */}
      <div style={{ display:'flex', borderBottom:'1px solid #1a0510', background:'#0c050d', flexShrink:0 }}>
        {Object.entries(GAMES).map(([key, g]) => (
          <button key={key} onClick={() => switchGame(key)}
            style={{ flex:1, padding:'11px 8px', fontSize:11, color: gameKey===key ? '#c8922a' : '#4a1a28', borderBottom: gameKey===key ? '2px solid #c8200a' : '2px solid transparent', background: gameKey===key ? '#0f0610' : 'transparent', letterSpacing:1, fontFamily:"'Georgia',serif", border:'none', borderBottom: gameKey===key ? '2px solid #c8200a' : '2px solid transparent', cursor:'pointer' }}>
            {g.name}
          </button>
        ))}
      </div>

      {/* AI PREDICTION PANEL */}
      <div style={{ margin:'12px 12px 0', background:'#0f0610', border:'1px solid #2d0a18' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderBottom:'1px solid #1a0510' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:10, color:'#6a2535', letterSpacing:1.5, fontFamily:'monospace' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#c8200a', animation:'blink 1.4s infinite' }}></div>
            AI ANALYSIS · GROQ
          </div>
          <div style={{ fontSize:10, color:'#3a1020', fontFamily:'monospace' }}>{game.name}</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', border:`3px solid ${predC.borderColor}`, background:predC.background, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', transition:'all 0.3s' }}>
            <div style={{ position:'absolute', inset:5, borderRadius:'50%', border:`1px solid ${predC.borderColor}`, opacity:0.35 }}></div>
            <span style={{ fontSize:24, fontWeight:700, color:predC.color, position:'relative', zIndex:1 }}>{pat.sug || '?'}</span>
            <span style={{ fontSize:8, fontFamily:'monospace', letterSpacing:1, color:predC.color, opacity:0.7, position:'relative', zIndex:1 }}>
              {pat.sug ? (pat.sug==='B'?game.B:pat.sug==='P'?game.P:'TIE') : 'TUNGGU'}
            </span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, color:'#d4a870', marginBottom:3 }}>
              {pat.sug ? `Saran: ${pat.sug==='B'?game.B:pat.sug==='P'?game.P:'TIE'}` : 'Menunggu data...'}
            </div>
            <div style={{ fontSize:11, color:'#5a2535', fontFamily:'monospace', lineHeight:1.6 }}>{pat.reason}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0 }}>
            <div style={{ fontSize:26, fontWeight:700, color:'#c8922a', fontFamily:'monospace', lineHeight:1 }}>
              {pat.conf ? pat.conf+'%' : '—'}
            </div>
            <div style={{ width:48, height:4, background:'#1a0510' }}>
              <div style={{ height:'100%', width:pat.conf+'%', background:confColor, transition:'width 0.5s' }}></div>
            </div>
            <div style={{ fontSize:9, color:'#3a1020', fontFamily:'monospace' }}>CONFIDENCE</div>
          </div>
        </div>

        <div style={{ padding:'8px 14px 10px', borderTop:'1px solid #1a0510' }}>
          <div style={{ fontSize:11, color:'#7a4040', fontFamily:'monospace', lineHeight:1.7, fontStyle:'italic', minHeight:16 }}>
            {aiLoading ? '◈ Menganalisis...' : aiText}
          </div>
        </div>

        <div style={{ display:'flex', gap:5, padding:'7px 12px', borderTop:'1px solid #1a0510', overflowX:'auto' }}>
          {pat.chips.length ? pat.chips.map((c,i) => <div key={i} style={chipTagStyle(c.c)}>{c.t}</div>)
            : <div style={chipTagStyle('grey')}>MENUNGGU INPUT</div>}
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, padding:'10px 12px' }}>
        {[['B',cnt.B,game.B,bP],['P',cnt.P,game.P,pP],['T',cnt.T,game.T,tP],['S',getStreak(results).n,getStreak(results).v?game[getStreak(results).v]||'TIE':'STREAK',null]].map(([type,val,lbl,pct])=>(
          <div key={type} style={{ background:'#0f0610', border:'1px solid #1a0510', padding:'8px 6px', textAlign:'center' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${chipStyle(type==='S'?getStreak(results).v||'X':type).borderColor}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 4px', fontSize:12, fontWeight:700, color:chipStyle(type==='S'?getStreak(results).v||'X':type).color, background:chipStyle(type==='S'?getStreak(results).v||'X':type).background }}>
              {type==='S'?getStreak(results).v||'~':type}
            </div>
            <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:chipStyle(type==='S'?getStreak(results).v||'X':type).color }}>{val}</div>
            <div style={{ fontSize:9, color:'#3a1020', fontFamily:'monospace', marginTop:1 }}>{pct!==null?pct+'%':lbl}</div>
          </div>
        ))}
      </div>

      {/* BEAD PLATE */}
      <div style={{ padding:'0 12px 10px' }}>
        <div style={{ fontSize:9, color:'#3a1020', letterSpacing:1.5, fontFamily:'monospace', marginBottom:5 }}>BEAD PLATE</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {results.map((r,i) => (
            <div key={i} style={{ width:26, height:26, borderRadius:'50%', border:`2px solid ${chipStyle(r).borderColor}`, background:chipStyle(r).background, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:chipStyle(r).color }}>
              {r}
            </div>
          ))}
          {!results.length && <div style={{ fontSize:11, color:'#2a0a10', fontFamily:'monospace' }}>Belum ada data...</div>}
        </div>
      </div>

      {/* INPUT CHIPS */}
      <div style={{ padding:'12px 12px 16px', background:'#0f0610', borderTop:'1px solid #2d0a18', marginTop:'auto' }}>
        <div style={{ fontSize:9, color:'#3a1020', letterSpacing:2, fontFamily:'monospace', textAlign:'center', marginBottom:14 }}>
          TAP CHIP — {game.name}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:12 }}>
          {['B','P','T'].map(type => {
            const cs = chipStyle(type)
            const isPressed = pressed === type
            return (
              <div key={type} style={{ flex:1, display:'flex', justifyContent:'center' }}>
                <button onClick={() => addR(type)}
                  style={{ borderRadius:'50%', border:`3px solid ${cs.borderColor}`, background: isPressed ? cs.background : 'transparent', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, position:'relative', width:'100%', maxWidth:100, aspectRatio:'1', transform: isPressed?'scale(0.92)':'scale(1)', transition:'transform 0.1s,background 0.1s' }}>
                  <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:`1px solid ${cs.borderColor}`, opacity:0.3 }}></div>
                  <span style={{ fontSize:28, fontWeight:700, color:cs.color, position:'relative', zIndex:1, lineHeight:1 }}>{type}</span>
                  <span style={{ fontSize:10, fontFamily:'monospace', letterSpacing:1, color:cs.color, opacity:0.7, position:'relative', zIndex:1 }}>
                    {type==='B'?game.B:type==='P'?game.P:game.T}
                  </span>
                  <span style={{ fontSize:9, fontFamily:'monospace', color:cs.color, opacity:0.5, position:'relative', zIndex:1 }}>
                    {type==='B'?bP:type==='P'?pP:tP}%
                  </span>
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <button onClick={undo} style={{ padding:11, fontSize:12, border:'1px solid #3a1020', color:'#8a2030', background:'transparent', fontFamily:'monospace', letterSpacing:1 }}>
            ← UNDO
          </button>
          <button onClick={newSesi} style={{ padding:11, fontSize:12, border:'1px solid #8a6018', color:'#c8922a', background:'transparent', fontFamily:'monospace', letterSpacing:1 }}>
            + SESI BARU
          </button>
        </div>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
    </div>
  )
}
