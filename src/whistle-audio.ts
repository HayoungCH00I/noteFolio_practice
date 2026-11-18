/** User-activated whistle effects only; the monologue itself has no voice. */
export class WhistleAudio {
  private context: AudioContext | null = null
  private nodes = new Set<AudioScheduledSourceNode>()

  unlock() {
    try {
      if (!this.context) this.context = new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch { /* Text and long-press interactions also work without Web Audio. */ }
  }

  play(short: boolean) {
    this.unlock()
    const context = this.context
    if (!context) return
    this.stop()
    const start = context.currentTime
    const duration = short ? 0.13 : 0.55
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(0.065, start + 0.012)
    envelope.gain.setValueAtTime(0.065, start + duration - 0.045)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    envelope.connect(context.destination)
    let remaining = 2
    for (const frequency of [2020, 2350]) {
      const tone = context.createOscillator()
      tone.type = 'sine'
      tone.frequency.setValueAtTime(frequency * 0.91, start)
      tone.frequency.exponentialRampToValueAtTime(frequency, start + 0.025)
      tone.frequency.setValueAtTime(frequency, start + duration - 0.05)
      tone.frequency.linearRampToValueAtTime(frequency * 0.96, start + duration)
      tone.connect(envelope)
      this.nodes.add(tone)
      tone.onended = () => {
        this.nodes.delete(tone)
        tone.disconnect()
        remaining--
        if (!remaining) envelope.disconnect()
      }
      tone.start(start)
      tone.stop(start + duration + 0.02)
    }
  }

  stop() {
    for (const node of this.nodes) { try { node.stop() } catch { /* Already stopped. */ } }
    this.nodes.clear()
  }
}
