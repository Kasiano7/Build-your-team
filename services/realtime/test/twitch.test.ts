import { describe, expect, it } from 'vitest';
import { parseChatVote } from '../src/twitch';

describe('Twitch chat vote parsing', () => {
  it('accepts !1…!4 and !vote N, nothing else', () => {
    expect(parseChatVote('!2')).toBe(2);
    expect(parseChatVote('  !vote 3  ')).toBe(3);
    expect(parseChatVote('!VOTE4')).toBe(4);
    expect(parseChatVote('!1 trop fort')).toBe(1);
    expect(parseChatVote('!5')).toBeNull();
    expect(parseChatVote('!12')).toBeNull();
    expect(parseChatVote('vote 2')).toBeNull();
    expect(parseChatVote('gg !2')).toBeNull();
  });
});
