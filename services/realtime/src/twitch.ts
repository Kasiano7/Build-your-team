/**
 * Read-only, anonymous Twitch chat listener (IRC over WebSocket).
 *
 * Twitch accepts anonymous read-only logins with a `justinfan<digits>` nick:
 * no account, no token, nothing is ever posted. Messages "!1" … "!4" (or
 * "!vote 2") are reported as votes for the team with that number.
 */
import { log } from './log';

const URL = 'wss://irc-ws.chat.twitch.tv:443';
const VOTE = /^!(?:vote\s*)?([1-4])\b/i;

export interface ChatVote {
  user: string;
  team: number;
}

export class TwitchChat {
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    readonly channel: string,
    private readonly onVote: (v: ChatVote) => void,
  ) {
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(URL);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.retry = 0;
      ws.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
      ws.send(`JOIN #${this.channel}`);
      log('info', 'twitch_joined', { channel: this.channel });
    });
    ws.addEventListener('message', (ev) => {
      for (const line of String(ev.data).split('\r\n')) this.onLine(line);
    });
    ws.addEventListener('close', () => this.reconnect());
    ws.addEventListener('error', () => ws.close());
  }

  private onLine(line: string): void {
    if (!line) return;
    if (line.startsWith('PING')) {
      this.ws?.send(line.replace('PING', 'PONG'));
      return;
    }
    // :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const m = /^:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/.exec(line);
    if (!m) return;
    const vote = VOTE.exec(m[2]!.trim());
    if (vote) this.onVote({ user: m[1]!, team: Number(vote[1]) });
  }

  private reconnect(): void {
    if (this.closed) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
    this.timer = setTimeout(() => this.connect(), delay);
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}

export const parseChatVote = (message: string): number | null => {
  const m = VOTE.exec(message.trim());
  return m ? Number(m[1]) : null;
};
