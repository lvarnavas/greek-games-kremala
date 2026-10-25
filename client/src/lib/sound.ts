// Απλά ηχητικά εφέ με Web Audio (χωρίς αρχεία ήχου, λειτουργούν offline).
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}

export function play(kind: 'correct' | 'wrong' | 'win' | 'lose' | 'tick'): void {
  if (!enabled) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  if (kind === 'correct') { tone(660, 0, 0.12); tone(880, 0.08, 0.15); }
  if (kind === 'wrong') { tone(220, 0, 0.2, 'square', 0.04); }
  if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.2, 'triangle')); }
  if (kind === 'lose') { [392, 330, 262].forEach((f, i) => tone(f, i * 0.15, 0.25, 'sawtooth', 0.04)); }
  if (kind === 'tick') tone(1200, 0, 0.04, 'sine', 0.03);
}

export function vibrate(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* δεν υποστηρίζεται */
  }
}
