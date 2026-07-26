export const MIN_DEBOUNCE_MS = 75;
export const MAX_DEBOUNCE_MS = 150;

export function clampDebounceMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.min(MAX_DEBOUNCE_MS, Math.max(MIN_DEBOUNCE_MS, Math.round(value)));
}

export class CompletionDebouncer {
  private timer: NodeJS.Timeout | undefined;
  private settle: ((ready: boolean) => void) | undefined;

  wait(delayMs: number): Promise<boolean> {
    this.cancel();
    return new Promise((resolve) => {
      this.settle = resolve;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.settle = undefined;
        resolve(true);
      }, clampDebounceMs(delayMs));
    });
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.settle?.(false);
    this.settle = undefined;
  }

  dispose(): void {
    this.cancel();
  }
}
