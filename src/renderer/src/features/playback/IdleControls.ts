/** One inactivity timer, independent of playback timestamp updates. */
export class IdleControls {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pinned = false
  constructor(
    private readonly onVisible: (visible: boolean) => void,
    private readonly delay = 2800,
  ) {}

  reveal(): void {
    clearTimeout(this.timer)
    this.onVisible(true)
    if (!this.pinned) this.timer = setTimeout(() => this.onVisible(false), this.delay)
  }

  pin(pinned: boolean): void {
    this.pinned = pinned
    this.reveal()
  }

  dispose(): void {
    clearTimeout(this.timer)
  }
}
