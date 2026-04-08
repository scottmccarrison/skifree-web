// Preset emote messages for spectator chat. Wire format is just the integer
// id - keeps payloads tiny and lets us reskin or localize later without a
// server change.
export const CHAT_PRESETS = [
  { id: 1, emoji: '\u{1F43F}\u{FE0F}', text: 'I HATE SQUIRRELS' },
  { id: 2, emoji: '\u{1F9CC}', text: 'yeti ate my legs' },
  { id: 3, emoji: '\u{1F332}', text: 'that tree had it coming' },
  { id: 4, emoji: '\u{1F480}', text: 'skill issue (mine)' },
  { id: 5, emoji: '\u{1F525}', text: 'SEND IT' },
  { id: 6, emoji: '\u{1F624}', text: 'unlucky bump' },
  { id: 7, emoji: '\u{1F410}', text: 'absolute legend' },
  { id: 8, emoji: '\u{1FAE0}', text: 'i am one with the snow' },
];

export function getPreset(id) {
  return CHAT_PRESETS.find(p => p.id === id) || null;
}
