// Persistent player profile: stats across runs.
//
// Schema versioned via DEFAULT - any missing keys on load are filled in
// from the default so adding new fields later is forward-compatible.

const KEY = 'skifree.profile';

const DEFAULT = {
  stats: {
    totalRuns: 0,
    runsToday: 0,
    todayDate: '',      // 'YYYY-MM-DD' local - resets runsToday on rollover
    lastRunDate: '',
    recentResults: [],  // sliding window of last 12 runs: 'pb' | 'worse'
  },
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    return {
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

// Called from endRun. Updates the sliding window.
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
