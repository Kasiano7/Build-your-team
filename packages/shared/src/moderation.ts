/**
 * Minimal nickname moderation, applied on both client and server.
 * Normalises accents and common leetspeak, then looks for blocked terms.
 * This is a baseline only: replace with a maintained list or a moderation
 * service before scaling (see docs/STORE_RELEASE.md, guideline 1.2).
 */
const BLOCKED = [
  // French
  'connard', 'connasse', 'salope', 'encule', 'enculer', 'pute', 'putain', 'batard', 'merde', 'nique', 'niquer', 'fdp', 'ntm', 'pd', 'tapette', 'bougnoul', 'negro', 'youpin',
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
  // Extremism
  'nazi', 'hitler', 'kkk',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

export function normaliseForModeration(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '');
}

/**
 * Terms of 4 letters or fewer must match a whole word (avoids refusing "Dickson");
 * longer terms match anywhere, even with spaces or symbols in between.
 */
export function isNicknameAllowed(nickname: string): boolean {
  const joined = normaliseForModeration(nickname);
  const words = nickname.split(/[\s_.\-']+/).map(normaliseForModeration).filter(Boolean);
  return !BLOCKED.some((term) => (term.length <= 4 ? words.includes(term) || joined === term : joined.includes(term)));
}
