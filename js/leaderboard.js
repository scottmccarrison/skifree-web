// Leaderboard client. Talks to the worker at /ski/api/* when hosted, or
// /api/* when run from the worker dev server.

const API_BASE = (() => {
  // When the page is at mccarrison.me/ski/* the API is at /ski/api/*.
  // When developing locally via `wrangler dev` the worker strips /ski itself.
  if (location.pathname.startsWith('/ski')) return '/ski/api';
  return '/api';
})();

const NAME_KEY = 'skifree.playerName';

export function getStoredName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function setStoredName(name) {
  localStorage.setItem(NAME_KEY, name);
}

export async function fetchLeaderboard() {
  try {
    const r = await fetch(`${API_BASE}/leaderboard`);
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    return data.scores || [];
  } catch (e) {
    console.warn('leaderboard fetch failed', e);
    return null;
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
    return data.scores || [];
  } catch (e) {
    console.warn('score submit failed', e);
    return null;
  }
}
