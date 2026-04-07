// Player shirt colors. Indices match the server's color assignment.
export const PLAYER_COLORS = [
  '#3bd1d1', // 0 cyan (default host)
  '#3a7df0', // 1 blue
  '#e84545', // 2 red
  '#3fbf57', // 3 green
  '#f08a1f', // 4 orange
  '#9858d9', // 5 purple
  '#f5d340', // 6 yellow
  '#ec5fb1', // 7 pink
  '#f5f5f5', // 8 white
  '#8b5a2b', // 9 brown
];

export function colorForIndex(idx) {
  if (typeof idx !== 'number' || idx < 0 || idx >= PLAYER_COLORS.length) return PLAYER_COLORS[0];
  return PLAYER_COLORS[idx];
}
