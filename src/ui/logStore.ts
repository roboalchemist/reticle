export interface LogOutput {
  appendLine(value: string): void;
  clear(): void;
  show(preserveFocus?: boolean): void;
}

export type LogListener = (text: string) => void;

export class ReticleLogStore {
  private readonly entries: string[] = [];
  private readonly listeners = new Set<LogListener>();

  constructor(
    private readonly output: LogOutput,
    private readonly maximumEntries = 400,
    private readonly now: () => Date = () => new Date(),
  ) {}

  appendLine(value: string): void {
    this.output.appendLine(value);
    const timestamp = this.now().toISOString().slice(11, 19);
    this.entries.push(`[${timestamp}] ${value}`);
    if (this.entries.length > this.maximumEntries) {
      this.entries.splice(0, this.entries.length - this.maximumEntries);
    }
    this.emit();
  }

  clear(): void {
    this.entries.length = 0;
    this.output.clear();
    this.emit();
  }

  show(): void {
    this.output.show(true);
  }

  text(): string {
    return this.entries.join("\n");
  }

  onDidChange(listener: LogListener): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private emit(): void {
    const text = this.text();
    for (const listener of this.listeners) {
      listener(text);
    }
  }
}
