/** Structured JSON logs (one line per event) — easy to ship to any log drain. */
export function log(level: 'info' | 'warn' | 'error', msg: string, data: Record<string, unknown> = {}): void {
  if (process.env.LOG_LEVEL === 'silent') return;
  if (process.env.LOG_LEVEL === 'error' && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  if (level === 'error') console.error(line);
  else console.log(line);
}
