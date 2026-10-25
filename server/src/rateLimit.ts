/** Token bucket: έως `capacity` ενέργειες σε ριπή, ανανέωση `refillPerSec`. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private capacity = 8, private refillPerSec = 4) {}

  take(key: string, now: number): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.at) / 1000) * this.refillPerSec);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    this.buckets.set(key, b);
    return ok;
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }
}
