export type PopVariant = 0 | 1 | 2
export type PopSoundKind = 'pop' | 'fart'

/** Three short, distinct plastic pops, generated locally without sound downloads. */
export function createPopSamples(variant: PopVariant, sampleRate: number, random = Math.random): Float32Array {
  const duration = [0.085, 0.115, 0.14][variant]!
  const samples = new Float32Array(Math.ceil(sampleRate * duration))
  let coloredNoise = 0
  let phase = 0
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate
    const noise = random() * 2 - 1
    coloredNoise = coloredNoise * 0.65 + noise * 0.35
    const attack = Math.min(1, t / 0.0008)
    let sample: number
    if (variant === 0) {
      phase += (220 + 1800 * Math.exp(-t * 140)) / sampleRate * Math.PI * 2
      sample = (noise - coloredNoise) * Math.exp(-t * 95) * 0.75 + Math.sin(phase) * Math.exp(-t * 85) * 0.25
    } else if (variant === 1) {
      phase += (90 + 650 * Math.exp(-t * 100)) / sampleRate * Math.PI * 2
      sample = coloredNoise * Math.exp(-t * 58) * 0.9 + Math.sin(phase) * Math.exp(-t * 62) * 0.4
    } else {
      const echo = Math.max(0, t - 0.025)
      const envelope = Math.exp(-t * 100) + (t >= 0.025 ? 0.55 * Math.exp(-echo * 95) : 0)
      phase += (150 + 1100 * Math.exp(-t * 110)) / sampleRate * Math.PI * 2
      sample = (noise - coloredNoise * 0.7) * envelope * 0.65 + Math.sin(phase) * Math.exp(-t * 70) * 0.22
    }
    const fade = Math.min(1, (duration - t) / 0.008)
    samples[i] = Math.max(-1, Math.min(1, sample * attack * fade)) * 0.65
  }
  return samples
}

/** A rounded cartoon "bwoooong": quick pitch lift, rubbery slide, and a ringing tail. */
export function createFartSamples(sampleRate: number, random = Math.random): Float32Array {
  const duration = 0.82
  const samples = new Float32Array(Math.ceil(sampleRate * duration))
  const tau = Math.PI * 2
  let phase = 0
  let breath = 0
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate
    const lift = 1 - Math.exp(-t * 90)
    const glide = 155 * Math.exp(-t * 4.2) * (0.62 + 0.38 * lift)
    const wobble = Math.sin(t * tau * 6.5) * 16 * Math.exp(-t * 2.8)
    const pitch = 82 + glide + wobble
    phase += pitch / sampleRate * tau
    breath = breath * 0.75 + (random() * 2 - 1) * 0.25
    // Mostly sine tones keep the vowel round; the upper partial softens as it trails off.
    const vowel = Math.sin(phase) * 0.9
      + Math.sin(phase * 2) * (0.2 + 0.2 * Math.exp(-t * 8))
      + Math.sin(phase * 3) * 0.07
    const flutter = 0.94 + 0.06 * Math.sin(t * tau * 7)
    const attack = Math.min(1, t / 0.012)
    const tail = Math.min(1, (duration - t) / 0.2)
    const envelope = attack * Math.exp(-t * 1.9) * tail
    const puff = breath * Math.exp(-t * 75) * 0.06
    samples[i] = Math.tanh(vowel * 1.65 + puff) * flutter * envelope * 0.86
  }
  return samples
}

/** Bake three fading reflections into a buffer so stopping audio also stops its echoes. */
export function createEchoSamples(dry: Float32Array, sampleRate: number): Float32Array {
  const echoes = [{ time: 0, gain: 1 }, { time: 0.12, gain: 0.44 }, { time: 0.245, gain: 0.24 }, { time: 0.37, gain: 0.12 }]
  const wet = new Float32Array(dry.length + Math.ceil(sampleRate * 0.37))
  for (const echo of echoes) {
    const offset = Math.round(sampleRate * echo.time)
    for (let i = 0; i < dry.length; i++) wet[i + offset] = wet[i + offset]! + dry[i]! * echo.gain
  }
  for (let i = 0; i < wet.length; i++) wet[i] = Math.max(-0.8, Math.min(0.8, wet[i]!))
  return wet
}

/** Exactly one surprise per twenty sounds, with its position shuffled each time. */
export class PopSoundChoices {
  private bag: boolean[] = []
  next(): number {
    if (this.bag.length === 0) {
      this.bag = [...Array<boolean>(19).fill(false), true]
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const item = this.bag[i]!
        this.bag[i] = this.bag[j]!
        this.bag[j] = item
      }
    }
    return this.bag.pop() ? 3 : Math.floor(Math.random() * 3)
  }
}

export class PopAudio {
  private context: AudioContext | null = null
  private buffers: AudioBuffer[] = []
  private echoBuffers: AudioBuffer[] = []
  private choices = new PopSoundChoices()
  private lastPlayed = -Infinity
  private output: GainNode | null = null
  private fartOutput: GainNode | null = null
  private sources = new Set<AudioBufferSourceNode>()
  muted = false

  /** Called synchronously from a user gesture so mobile browsers can unlock audio. */
  unlock(): boolean {
    if (this.muted) return true
    try {
      if (!this.context) {
        this.context = new AudioContext()
        const compressor = this.context.createDynamicsCompressor()
        compressor.threshold.value = -15
        compressor.ratio.value = 6
        this.output = this.context.createGain()
        this.output.gain.value = 0.48
        this.output.connect(compressor)
        this.fartOutput = this.context.createGain()
        this.fartOutput.gain.value = 1.25
        this.fartOutput.connect(this.output)
        compressor.connect(this.context.destination)
        const makeBuffer = (samples: Float32Array): AudioBuffer => {
          const buffer = this.context!.createBuffer(1, samples.length, this.context!.sampleRate)
          buffer.getChannelData(0).set(samples)
          return buffer
        }
        const samples = ([0, 1, 2] as const).map(variant => createPopSamples(variant, this.context!.sampleRate))
        samples.push(createFartSamples(this.context.sampleRate))
        this.buffers = samples.map(makeBuffer)
        this.echoBuffers = samples.map(wave => makeBuffer(createEchoSamples(wave, this.context!.sampleRate)))
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      return true
    } catch {
      return false
    }
  }

  play(): PopSoundKind {
    const variant = this.choices.next()
    const kind: PopSoundKind = variant === 3 ? 'fart' : 'pop'
    if (this.muted || !this.unlock() || !this.context || !this.output) return kind
    // Bound overlapping audio when someone swipes through many bubbles at once.
    if (this.sources.size >= 16) {
      const oldest = this.sources.values().next().value
      oldest?.stop()
      if (oldest) this.sources.delete(oldest)
    }
    const source = this.context.createBufferSource()
    const now = performance.now()
    const echo = variant !== 3 && now - this.lastPlayed >= 120
    this.lastPlayed = now
    source.buffer = (echo ? this.echoBuffers : this.buffers)[variant]!
    source.connect(variant === 3 ? this.fartOutput! : this.output)
    this.sources.add(source)
    source.onended = () => { this.sources.delete(source); source.disconnect() }
    source.start()
    return kind
  }

  stop() {
    for (const source of this.sources) source.stop()
    this.sources.clear()
    this.lastPlayed = -Infinity
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.muted) this.stop()
    else this.unlock()
    return this.muted
  }
}
