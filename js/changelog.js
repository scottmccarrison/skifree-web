// Changelog entries shown in the feedback modal. Newest first.
// LATEST_VERSION is compared against localStorage 'skifree.changelogSeen'
// to pulse the ? button when there's something new to look at.
export const LATEST_VERSION = 'v0.4.0';

export const CHANGELOG = [
  {
    version: 'v0.4',
    items: [
      'NEW: spectator chat - tap a preset to talk while watching others race',
    ],
  },
  {
    version: 'v0.3 - multiplayer',
    items: [
      'NEW: multiplayer - host or join a 4-letter code and ski together',
      'NEW: squirrels sprint across the slope after 300m',
      'TWEAK: yeti speed now scales with the player it is chasing',
      'TWEAK: tree lights only appear after 500m',
      'TWEAK: snow drifts at an angle',
      'FIX: feedback button now pauses solo runs',
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
