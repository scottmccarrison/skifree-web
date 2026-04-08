// Persistent player profile: cosmetic unlocks, equipped item, and stats
// across runs. Single source of truth for everything achievement-related.
//
// Schema versioned via DEFAULT - any missing keys on load are filled in
// from the default so adding new fields later is forward-compatible.

const KEY = 'skifree.profile';

const DEFAULT = {
  unlocks: [],          // catalog cosmetic IDs already earned
  equipped: null,       // single string or null
  stats: {
    totalRuns: 0,
    runsToday: 0,
    todayDate: '',      // 'YYYY-MM-DD' local - resets runsToday on rollover
    lastRunDate: '',    // for Touch Grass (24h+ gap)
    recentResults: [],  // sliding window of last 12 runs: 'pb' | 'worse'
  },
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    // Forward-compat: deep-merge missing fields from DEFAULT.
    return {
      unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks.slice() : [],
      equipped: typeof parsed.equipped === 'string' ? parsed.equipped : null,
      stats: {
        ...DEFAULT.stats,
        ...(parsed.stats || {}),
        recentResults: Array.isArray(parsed.stats?.recentResults)
          ? parsed.stats.recentResults.slice()
          : [],
      },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function isUnlocked(p, id) {
  return p.unlocks.includes(id);
}

// Returns true if this is a NEW unlock (caller should fire toast). Idempotent.
export function unlock(p, id) {
  if (p.unlocks.includes(id)) return false;
  p.unlocks.push(id);
  saveProfile(p);
  return true;
}

export function equip(p, id) {
  // Refuse to equip something the player hasn't unlocked.
  if (id !== null && !p.unlocks.includes(id)) return;
  p.equipped = id;
  saveProfile(p);
}

export function unequip(p) {
  p.equipped = null;
  saveProfile(p);
}

// Called from startRun. Bumps totalRuns + runsToday, rolling over the daily
// counter at local midnight.
export function bumpStartRun(p) {
  const today = todayKey();
  if (p.stats.todayDate !== today) {
    p.stats.runsToday = 0;
    p.stats.todayDate = today;
  }
  p.stats.runsToday += 1;
  p.stats.totalRuns += 1;
  saveProfile(p);
}

// Called from endRun. Updates the sliding window used by Hot Streak,
// Comeback Kid, and the lastRunDate used by Touch Grass.
export function recordRunResult(p, finalScore, prevHighScore) {
  const wasPB = Math.floor(finalScore) > Math.floor(prevHighScore || 0);
  p.stats.recentResults.push(wasPB ? 'pb' : 'worse');
  if (p.stats.recentResults.length > 12) p.stats.recentResults.shift();
  p.stats.lastRunDate = todayKey();
  saveProfile(p);
  return wasPB;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
