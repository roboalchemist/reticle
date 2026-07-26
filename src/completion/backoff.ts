export interface BackoffSnapshot {
  consecutiveFailures: number;
  retryAt: number;
}

export class ErrorBackoff {
  private consecutiveFailures = 0;
  private retryAt = 0;

  constructor(
    private readonly threshold = 3,
    private readonly baseDelayMs = 5_000,
    private readonly maximumDelayMs = 60_000,
  ) {}

  canRequest(now = Date.now()): boolean {
    return now >= this.retryAt;
  }

  recordFailure(now = Date.now()): BackoffSnapshot {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold) {
      const exponent = this.consecutiveFailures - this.threshold;
      const delay = Math.min(this.maximumDelayMs, this.baseDelayMs * 2 ** exponent);
      this.retryAt = now + delay;
    }
    return this.snapshot();
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.retryAt = 0;
  }

  snapshot(): BackoffSnapshot {
    return { consecutiveFailures: this.consecutiveFailures, retryAt: this.retryAt };
  }

  retryInMs(now = Date.now()): number {
    return Math.max(0, this.retryAt - now);
  }
}
