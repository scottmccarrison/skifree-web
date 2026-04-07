// Changelog entries shown in the feedback modal. Newest first.
// LATEST_VERSION is compared against localStorage 'skifree.changelogSeen'
// to pulse the ? button when there's something new to look at.
export const LATEST_VERSION = 'v0.3';

export const CHANGELOG = [
  {
    version: 'v0.3 - multiplayer',
    items: [
      'NEW: multiplayer - host a run, share the 4-letter code, ski together',
      'NEW: up to 10 players per room, each gets a unique shirt color',
      'NEW: yeti chases the slowest player and works its way up',
      'NEW: spectate friends after you crash, tap to cycle through players',
      'NEW: late joiners drop straight into spectator mode and watch live',
      'NEW: rematch screen with ready checkmarks for the next round',
      'NEW: host can kick idle players from the lobby',
    ],
  },
  {
    version: 'v0.2 - playtest',
    items: [
      'NEW: daily / all-time / personal best leaderboard tabs',
      'NEW: yeti is faster and now does flyby visits',
      'NEW: moguls are 3D bumps that give a little hop',
      'NEW: obstacle legend on the title screen',
      'NEW: Christmas decor on trees and yeti',
      'NEW: progression layers - snowflakes, aurora, night mode',
      'NEW: persistent death counter',
      'NEW: feedback now includes rich diagnostics',
    ],
  },
];
