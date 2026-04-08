// Achievement definitions. Each entry maps a trigger condition to a cosmetic
// unlock. Tests are pure: (game, profile, ctx) -> bool. ctx is an optional
// payload for events that can't be derived from per-frame state, like
// causeOfDeath ('tree'|'squirrel'|'yeti'|'forced') or leaderboard rank.
//
// when:
//   'frame'       - checked every frame during 'playing'
//   'startRun'    - checked once when a new run begins
//   'endRun'      - checked once when a run ends (causeOfDeath available)
//   'leaderboard' - checked when submitScore returns

import { unlock } from './profile.js';

export const ACHIEVEMENTS = [
  {
    id: 'first_run', name: 'First Run',
    description: 'Complete your very first run.',
    unlocks: 'lift_pass', when: 'endRun',
    test: (g, p) => p.stats.totalRuns >= 1,
  },
  {
    id: 'baby_steps', name: 'I Remember My First Video Game',
    description: 'Crash with a score under 10m.',
    unlocks: 'dunce_cap', when: 'endRun',
    test: (g) => Math.floor(g.score) < 10,
  },
  {
    id: 'speedrun_strats', name: 'Speedrun Strats',
    description: 'Crash within 5 seconds of starting.',
    unlocks: 'roadrunner_sneakers', when: 'endRun',
    test: (g) => g.elapsed < 5,
  },
  {
    id: 'tunnel_vision', name: 'Tunnel Vision',
    description: 'Reach 500m without ever turning.',
    unlocks: 'blinders', when: 'frame',
    test: (g) => !g.run.turnedEver && g.score >= 500,
  },
  {
    id: 'paranoid', name: 'The Yetis Are Watching',
    description: 'Open feedback 5 times in a single run.',
    unlocks: 'tinfoil_hat', when: 'frame',
    test: (g) => g.run.pauses >= 5,
  },
  {
    id: 'k1_club', name: '1k Club',
    description: 'Reach 1000m.',
    unlocks: 'red_beanie', when: 'frame',
    test: (g) => g.score >= 1000,
  },
  {
    id: 'k5_club', name: '5k Club',
    description: 'Reach 5000m.',
    unlocks: 'sunglasses', when: 'frame',
    test: (g) => g.score >= 5000,
  },
  {
    id: 'night_owl', name: 'Night Owl',
    description: 'Survive into night mode.',
    unlocks: 'headlamp', when: 'frame',
    // Night mode is the stage-5 band: bandScore = score % 6000, stage 5 = 5000-5999
    test: (g) => (g.score % 6000) >= 5000,
  },
  {
    id: 'k10_club', name: '10k Club',
    description: 'Reach 10000m.',
    unlocks: 'gold_goggles', when: 'frame',
    test: (g) => g.score >= 10000,
  },
  {
    id: 'speed_demon', name: 'Speed Demon',
    description: 'Reach top speed without crashing.',
    unlocks: 'racing_stripes', when: 'frame',
    test: (g) => g.elapsed >= 90 && !g.run.crashedAtLeastOnce,
  },
  {
    id: 'yeti_survivor', name: 'Yeti Survivor',
    description: 'See the yeti for 10s, then die to something else.',
    unlocks: 'yeti_plushie', when: 'endRun',
    test: (g, p, ctx) => g.run.yetiVisibleSeconds >= 10 && ctx?.causeOfDeath !== 'yeti',
  },
  {
    id: 'frequent_flyer', name: 'Frequent Flyer',
    description: 'Hit 3 jumps in a single run.',
    unlocks: 'cape', when: 'frame',
    test: (g) => g.run.jumps >= 3,
  },
  {
    id: 'mogul_master', name: 'Mogul Master',
    description: 'Hit 10 moguls in a single run.',
    unlocks: 'knee_pads', when: 'frame',
    test: (g) => g.run.hops >= 10,
  },
  {
    id: 'roadkill', name: 'Roadkill',
    description: 'Die to a squirrel.',
    unlocks: 'acorn', when: 'endRun',
    test: (g, p, ctx) => ctx?.causeOfDeath === 'squirrel',
  },
  {
    id: 'yeti_snack', name: 'Yeti Snack',
    description: 'Get caught by the yeti.',
    unlocks: 'head_bandage', when: 'endRun',
    test: (g, p, ctx) => ctx?.causeOfDeath === 'yeti',
  },
  {
    id: 'edge_lord', name: 'Edge Lord',
    description: 'Drift 400 units off-center.',
    unlocks: 'hot_pink_jacket', when: 'frame',
    test: (g) => g.run.maxAbsX >= 400,
  },
  {
    id: 'marathon', name: 'Marathon',
    description: 'Play 20 runs in a single day.',
    unlocks: 'sweatband', when: 'startRun',
    test: (g, p) => p.stats.runsToday >= 20,
  },
  {
    id: 'insomniac', name: 'Insomniac',
    description: 'Start a run between 1am and 4am.',
    unlocks: 'pajamas', when: 'startRun',
    test: () => { const h = new Date().getHours(); return h >= 1 && h < 4; },
  },
  {
    id: 'touch_grass', name: 'Touch Grass',
    description: 'Come back after a day off.',
    unlocks: 'hawaiian_shirt', when: 'startRun',
    test: (g, p) => {
      if (!p.stats.lastRunDate) return false;
      const today = new Date(); today.setHours(0,0,0,0);
      const last = new Date(p.stats.lastRunDate); last.setHours(0,0,0,0);
      return (today - last) >= 24*60*60*1000;
    },
  },
  {
    id: 'hot_streak', name: 'Hot Streak',
    description: 'Set 3 personal bests in a row.',
    unlocks: 'comeback_crown', when: 'endRun',
    test: (g, p) => {
      const r = p.stats.recentResults;
      return r.length >= 3 && r.slice(-3).every(x => x === 'pb');
    },
  },
  {
    id: 'crown_stealer', name: 'Crown Stealer',
    description: 'Take #1 on the all-time leaderboard.',
    unlocks: 'real_crown', when: 'leaderboard',
    test: (g, p, ctx) => {
      const top = ctx?.alltime?.[0];
      return !!(top && ctx.myName && top.name === ctx.myName);
    },
  },
  {
    id: 'centurion', name: 'Centurion',
    description: 'Play 200 runs.',
    unlocks: 'centurion_stripes', when: 'startRun',
    test: (g, p) => p.stats.totalRuns >= 200,
  },
  {
    id: 'air_time', name: 'Air Time',
    description: 'Hit 5 jumps in a single run.',
    unlocks: 'wings', when: 'frame',
    test: (g) => g.run.jumps >= 5,
  },
  {
    id: 'snowcat', name: 'Snowcat',
    description: 'Hop 15 moguls in a single run.',
    unlocks: 'cat_ears', when: 'frame',
    test: (g) => g.run.hops >= 15,
  },
  {
    id: 'zen_mode', name: 'Zen Mode',
    description: 'Survive 60s without jumping or hopping.',
    unlocks: 'monk_robe', when: 'frame',
    test: (g) => g.elapsed >= 60 && g.run.jumps === 0 && g.run.hops === 0,
  },
  {
    id: 'moms_cooking', name: 'Just Like Mom Made',
    description: 'Die to a big tree.',
    unlocks: 'apron', when: 'endRun',
    test: (g, p, ctx) => ctx?.causeOfDeath === 'treeLarge',
  },
  {
    id: 'comeback_kid', name: 'Comeback Kid',
    description: 'Set a PB after 5 worse runs.',
    unlocks: 'phoenix_patch', when: 'endRun',
    test: (g, p) => {
      const r = p.stats.recentResults;
      if (r.length < 6) return false;
      const last = r[r.length-1];
      const prev5 = r.slice(-6, -1);
      return last === 'pb' && prev5.every(x => x === 'worse');
    },
  },
  {
    id: 'early_bird', name: 'Early Bird',
    description: 'Run between 5am and 7am.',
    unlocks: 'coffee_cup', when: 'startRun',
    test: () => { const h = new Date().getHours(); return h >= 5 && h < 7; },
  },
  {
    id: 'daily_champ', name: 'Daily Champ',
    description: 'Take #1 on the daily leaderboard.',
    unlocks: 'daily_crown', when: 'leaderboard',
    test: (g, p, ctx) => {
      const top = ctx?.daily?.[0];
      return !!(top && ctx.myName && top.name === ctx.myName);
    },
  },
  {
    id: 'completionist', name: 'Completionist',
    description: 'Unlock all 29 other cosmetics.',
    unlocks: 'halo', when: 'endRun',
    // Halo itself is the 30th, so unlocks length must be >= 29 of OTHERS.
    test: (g, p) => p.unlocks.filter(id => id !== 'halo').length >= 29,
  },
];

// Run all achievements in the given trigger phase. Returns array of newly
// unlocked entries [{ achievement, cosmeticId }] for the toast queue.
export function checkAchievements(phase, game, profile, ctx) {
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (a.when !== phase) continue;
    if (profile.unlocks.includes(a.unlocks)) continue;  // already earned
    if (!a.test(game, profile, ctx || {})) continue;
    if (unlock(profile, a.unlocks)) {
      newly.push({ achievement: a, cosmeticId: a.unlocks });
    }
  }
  return newly;
}
