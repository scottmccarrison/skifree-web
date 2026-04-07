// Leaderboard client. Talks to the worker at /ski/api/* when hosted, or
// /api/* when run from the worker dev server.

const API_BASE = (() => {
  // Match the first path segment exactly so /skidev doesn't get folded into
  // /ski. /ski/* -> /ski/api, /skidev/* -> /skidev/api, otherwise /api.
  const seg = location.pathname.split('/')[1] || '';
  if (seg === 'ski' || seg === 'skidev') return `/${seg}/api`;
  return '/api';
})();

const NAME_KEY = 'skifree.playerName';
const PERSONAL_BESTS_KEY = 'skifree.personalBests';
const PERSONAL_BESTS_MAX = 10;

export function getStoredName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function setStoredName(name) {
  localStorage.setItem(NAME_KEY, name);
}

export function getPersonalBests() {
  try {
    const raw = localStorage.getItem(PERSONAL_BESTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordPersonalBest(score) {
  const s = Math.floor(score);
  if (s <= 0) return getPersonalBests();
  const list = getPersonalBests();
  list.push({ score: s, at: Date.now() });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, PERSONAL_BESTS_MAX);
  try {
    localStorage.setItem(PERSONAL_BESTS_KEY, JSON.stringify(trimmed));
  } catch {}
  return trimmed;
}

// Returns the v2 board shape, or null on failure. Falls back to v1.
export async function fetchLeaderboard() {
  try {
    const r = await fetch(`${API_BASE}/leaderboard/v2`);
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    return normalizeBoard(data);
  } catch (e) {
    console.warn('leaderboard v2 fetch failed, trying v1', e);
    try {
      const r = await fetch(`${API_BASE}/leaderboard`);
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json();
      return normalizeBoard({ scores: data.scores || [] });
    } catch (e2) {
      console.warn('leaderboard v1 fetch failed', e2);
      return null;
    }
  }
}

export async function submitScore(name, score) {
  try {
    const r = await fetch(`${API_BASE}/score`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score: Math.floor(score) }),
    });
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    return normalizeBoard(data);
  } catch (e) {
    console.warn('score submit failed', e);
    return null;
  }
}

// Normalize a worker response into a consistent client shape.
function normalizeBoard(data) {
  if (data.daily || data.alltime || data.topEver) {
    return {
      daily: data.daily || [],
      alltime: data.alltime || data.scores || [],
      topEver: data.topEver || null,
      resetsAt: data.resetsAt || null,
      serverNow: data.serverNow || Date.now(),
    };
  }
  // v1 fallback
  const scores = data.scores || [];
  return {
    daily: [],
    alltime: scores,
    topEver: scores[0] || null,
    resetsAt: null,
    serverNow: Date.now(),
  };
}
