export class ChoirScoldPrompt {
  target = -1
  succeeded = false
  private badSeconds = 0
  private remaining = 0
  private cooldown = 0
  private random: () => number
  constructor(random = Math.random) { this.random = random }
  get active() { return this.target >= 0 }
  reset() { this.target = -1; this.succeeded = false; this.badSeconds = this.remaining = this.cooldown = 0 }
  advance(dt: number, singing: boolean, good: boolean, scolded: number, busy = false): 'started' | 'finished' | undefined {
    if (scolded < 0) this.succeeded = false
    const cooling = this.cooldown > 0
    if (singing) this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.active && scolded === this.target) { this.succeeded = true; return this.finish() }
    if (!singing || good) {
      this.badSeconds = 0
      if (this.active) return this.finish()
      return
    }
    if (this.active) {
      this.remaining -= dt
      if (this.remaining <= 0) return this.finish()
      return
    }
    if (cooling || busy) { this.badSeconds = 0; return }
    this.badSeconds += dt
    if (this.badSeconds < 3) return
    this.target = Math.min(3, Math.floor(this.random() * 4)); this.remaining = 5; this.badSeconds = 0
    return 'started'
  }
  private finish(): 'finished' { this.target = -1; this.remaining = this.badSeconds = 0; this.cooldown = 15; return 'finished' }
}
