/*
  Concentration (Memory Match) Game - React + TypeScript
  Placed into `src/App.tsx` so it can run in a Vite react-ts project.
*/

import React, { useEffect, useMemo, useState, useRef } from 'react';

type Card = {
  id: string;
  pairId: string;
  content: string;
  matched: boolean;
};

type Difficulty = 'easy' | 'medium' | 'hard';

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EMOJI_POOL = [
  '🍎','🍌','🍇','🍓','🥑','🍒','🍋','🍉','🥕','🍆','🍍','🥥','🥝','🌽','🥦','🍑','🍐','🍊','🍔','🍕','🍩','🍪','🍫','🍿','🍰','🍯','🧀','🥨'
];

function generateDeck(pairs: number) {
  const pool = shuffle(EMOJI_POOL).slice(0, pairs);
  const deck: Card[] = pool.flatMap((emoji, idx) => {
    const pairId = `p${idx}`;
    const a: Card = { id: pairId + 'a', pairId, content: emoji, matched: false };
    const b: Card = { id: pairId + 'b', pairId, content: emoji, matched: false };
    return [a, b];
  });
  return shuffle(deck);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

type Score = { name: string; seconds: number; moves: number; difficulty: Difficulty; date: string };
const STORAGE_KEY = 'concentration_game_leaderboard_v1';
const REMOTE_LEADERBOARD_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_LEADERBOARD_URL) || 'http://localhost:4000';

function loadLeaderboard(): Score[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Score[];
  } catch {
    return [];
  }
}

function saveScoreLocal(score: Score) {
  const board = loadLeaderboard();
  board.push(score);
  board.sort((a, b) => a.seconds - b.seconds || a.moves - b.moves);
  const trimmed = board.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

async function saveScoreRemote(score: Score) {
  try {
    await fetch(`${REMOTE_LEADERBOARD_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: score.name, seconds: score.seconds, moves: score.moves, difficulty: score.difficulty })
    });
  } catch (e) {
    // network error: fall back to local
    saveScoreLocal(score);
  }
}

async function loadLeaderboardRemote(difficulty?: Difficulty, limit = 20): Promise<Score[]> {
  try {
    const q = new URLSearchParams();
    if (difficulty) q.set('difficulty', difficulty);
    q.set('limit', String(limit));
    const res = await fetch(`${REMOTE_LEADERBOARD_URL}/api/leaderboard?` + q.toString());
    if (!res.ok) throw new Error('remote error');
    const data = await res.json();
    return data as Score[];
  } catch (e) {
    return loadLeaderboard();
  }
}

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [pairs, setPairs] = useState(12);
  const [deck, setDeck] = useState<Card[]>(() => generateDeck(12));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState('Player');
  const [leaderboard, setLeaderboard] = useState<Score[]>(() => loadLeaderboard());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(()=>{
    const map:{[k in Difficulty]: number} = { easy: 8, medium: 12, hard: 18 };
    setPairs(map[difficulty]);
    restart(map[difficulty]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  useEffect(()=>{
    if (running) {
      timerRef.current = window.setInterval(()=> setSeconds(s => s+1), 1000) as unknown as number;
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current as unknown as number);
        timerRef.current = null;
      }
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current as unknown as number); timerRef.current = null; } };
  }, [running]);

  useEffect(()=>{
    const onStorage = ()=> setLeaderboard(loadLeaderboard());
    window.addEventListener('storage', onStorage);
    return ()=> window.removeEventListener('storage', onStorage);
  }, []);

  function restart(p = pairs) {
    setDeck(generateDeck(p));
    setFlipped([]);
    setMoves(0);
    setMatches(0);
    setSeconds(0);
    setRunning(false);
    setLocked(false);
    setFocusedIndex(null);
  }

  function handleFlip(cardId: string) {
    if (locked) return;
    const card = deck.find(c => c.id === cardId);
    if (!card || card.matched) return;
    if (!running) setRunning(true);

    if (flipped.includes(cardId)) return;

    if (flipped.length === 0) {
      setFlipped([cardId]);
      const idx = deck.findIndex(c=>c.id===cardId);
      setFocusedIndex(idx);
      return;
    }

    if (flipped.length === 1) {
      const firstId = flipped[0];
      const firstCard = deck.find(c=>c.id===firstId)!;
      setFlipped([firstId, cardId]);
      setLocked(true);
      setMoves(m => m+1);

      if (firstCard.pairId === card.pairId) {
        setTimeout(async ()=>{
          setDeck(prev => prev.map(c => c.pairId === card.pairId ? {...c, matched: true} : c));
          setFlipped([]);
          setMatches(m => m+1);
          setLocked(false);
          const newMatchCount = matches + 1;
          if (newMatchCount === pairs) {
            setRunning(false);
            const s: Score = { name: name || 'Player', seconds, moves: moves+1, difficulty, date: new Date().toISOString() };
                // try to save remote, but keep local fallback
                saveScoreRemote(s);
                saveScoreLocal(s);
            const remote = await loadLeaderboardRemote(difficulty);
            setLeaderboard(remote);
          }
        }, 600);
      } else {
        setTimeout(()=>{
          setFlipped([]);
          setLocked(false);
        }, 800);
      }
      return;
    }
  }

  const allMatched = useMemo(()=> deck.every(c => c.matched), [deck]);

  const stars = useMemo(()=>{
    if (moves === 0) return 3;
    const ratio = moves / pairs;
    if (ratio <= 1.2) return 3;
    if (ratio <= 2) return 2;
    return 1;
  }, [moves, pairs]);

  useEffect(()=>{
    function onKey(e: KeyboardEvent) {
      if (!gridRef.current) return;
      const total = deck.length;
      if (total === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(fi => {
          const next = (fi === null ? 0 : (fi + 1) % total);
          return next;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(fi => {
          const prev = (fi === null ? 0 : (fi - 1 + total) % total);
          return prev;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedIndex !== null) {
          const card = deck[focusedIndex];
          handleFlip(card.id);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [deck, focusedIndex]);

  useEffect(()=>{
    if (focusedIndex === null) return;
    const btn = document.querySelector<HTMLButtonElement>(`button[data-index="${focusedIndex}"]`);
    if (btn) btn.focus();
  }, [focusedIndex]);

  return (
    <div className="min-h-screen flex items-start justify-center p-6" style={{background: 'linear-gradient(180deg,#f8fafc,#eef2ff)'}}>
      <div className="w-full container" style={{padding: '0 1rem'}}>
        <header className="app-header flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Concentration — Memory Match</h1>
            <p className="text-sm text-gray-600">Flip cards, find pairs, train your focus.</p>
          </div>
          <div className="text-right">
            <div className="mb-2">Time: <strong>{formatTime(seconds)}</strong></div>
            <div>Moves: <strong>{moves}</strong></div>
            <div>Stars: {'★'.repeat(stars)}{'☆'.repeat(3-stars)}</div>
          </div>
        </header>

          <div className="controls-container controls-area">
            <div className="controls-left">
            <label className="text-sm">Difficulty:</label>
            <select className="p-2 border rounded" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>
              <option value="easy">Easy (8 pairs)</option>
              <option value="medium">Medium (12 pairs)</option>
              <option value="hard">Hard (18 pairs)</option>
            </select>
            <button className="p-2 border rounded ml-2" onClick={()=> restart(pairs)}>Restart</button>
              <button className="p-2 border rounded ml-2" onClick={()=> setCompact(c=>!c)}>{compact ? 'Normal' : 'Compact'}</button>
            </div>

            <div className="controls-right">
              <input className="p-2 border rounded" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
              <button className="p-2 bg-blue-600 text-white rounded" onClick={()=>{ setRunning(r=>!r); if (!running) setRunning(true); }}>{running? 'Pause':'Start'}</button>
            </div>
        </div>

        <main className="game-area game-area-panel">
          <div ref={gridRef} className="grid gap-3 cards-grid game-grid-area" style={{gridAutoRows: '1fr'}}>
            {deck.map((card, idx) => {
              const isFlipped = flipped.includes(card.id) || card.matched || allMatched;
              // render emoji or image and make image fill the card
              const isImage = typeof card.content === 'string' && (
                card.content.startsWith('http') || card.content.startsWith('/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(card.content)
              );
              return (
                <button
                  key={card.id}
                  data-index={idx}
                  onClick={()=> handleFlip(card.id)}
                  aria-pressed={isFlipped}
                  aria-label={card.matched ? `Matched ${card.content}` : `Card ${idx+1}`}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xl select-none focus:outline-none focus:ring-4 transition transform card-button ${isFlipped ? 'flipped bg-white shadow-lg' : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'} ${card.matched ? 'matched' : ''}`}
                  style={{padding:6}}
                >
                  {isFlipped ? (
                    isImage ? (
                      // image fills the entire card
                      // card.content is treated as the image URL
                      // eslint-disable-next-line jsx-a11y/img-redundant-alt
                      <img src={card.content} alt="card image" />
                    ) : (
                      // emoji/text centered and sized
                      <span className="card-content emoji">{card.content}</span>
                    )
                  ) : (
                    null
                  )}
                </button>
              );
            })}
          </div>
        </main>

        <section className="sections-area mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel panel-progress p-4 rounded shadow">
            <h3 className="font-semibold">Progress</h3>
            <div className="mt-2">Pairs found: <strong>{matches}/{pairs}</strong></div>
            <div className="mt-2">Status: <strong>{allMatched ? 'Completed 🎉' : (running ? 'Running' : 'Idle')}</strong></div>
          </div>

          <div className="panel panel-leaderboard p-4 rounded shadow">
            <h3 className="font-semibold">Leaderboard (local)</h3>
            <ol className="mt-2 list-decimal list-inside">
              {leaderboard.length === 0 && <li className="text-sm text-gray-500">No scores yet - be the first!</li>}
              {leaderboard.map((s, i)=> (
                <li key={i} className="text-sm">
                  <strong>{s.name}</strong> — {formatTime(s.seconds)} / {s.moves} moves / {s.difficulty} <span className="text-xs text-gray-500">({new Date(s.date).toLocaleString()})</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <button className="p-2 border rounded" onClick={()=>{ localStorage.removeItem(STORAGE_KEY); setLeaderboard([]); }}>Clear Leaderboard</button>
              <button className="p-2 border rounded" onClick={()=> setLeaderboard(loadLeaderboard())}>Refresh</button>
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-gray-500">
          Tip: Use arrow keys to navigate cards and Enter to flip. Difficulty changes restart the game.
        </footer>
      </div>
    </div>
  );
}
