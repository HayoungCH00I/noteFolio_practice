import { choirVideo } from './choir-core.ts'

export class ChoirMusic {
  ready = false
  playing = false
  ended = false
  rate = 1
  position = choirVideo.start as number
  private context?: AudioContext
  private node?: AudioWorkletNode
  private pitchNode?: AudioWorkletNode
  private gain?: GainNode
  private playId = 0
  private disposed = false
  private cancel?: AbortController
  private generation = 0
  private desired = false
  private blocked = false
  private report?: (message: string) => void
  private lastPitch = NaN
  private lastRate = NaN
  async init(report: (message: string) => void, changed: () => void) {
    this.report = report
    this.cancel = new AbortController()
    try {
      const base = new URL(import.meta.env?.BASE_URL ?? '/', location.href)
      const context = new AudioContext(); this.context = context
      const response = await fetch(new URL('music.mp3', base), { signal: this.cancel.signal })
      if (!response.ok) throw new Error('music.mp3 음원 파일을 불러오지 못했어요.')
      const decoded = await context.decodeAudioData(await response.arrayBuffer())
      if (this.disposed) return
      if (decoded.duration < choirVideo.end) throw new Error('음원 길이가 1:52보다 짧아요. 전체 길이의 음원을 확인해 주세요.')
      await Promise.all([context.audioWorklet.addModule(new URL('choir-sampler.js', base)), context.audioWorklet.addModule(new URL('vendor/soundtouch/processor.js', base))])
      if (this.disposed) return
      const start = Math.round(choirVideo.start * decoded.sampleRate), end = Math.round(choirVideo.end * decoded.sampleRate)
      const channels = Array.from({ length: Math.min(2, decoded.numberOfChannels) }, (_, index) => decoded.getChannelData(index).slice(start, end))
      const node = new AudioWorkletNode(context, 'choir-sampler', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }); this.node = node
      this.pitchNode = new AudioWorkletNode(context, 'soundtouch-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
      this.gain = context.createGain(); this.gain.gain.value = 0
      node.connect(this.pitchNode); this.pitchNode.connect(this.gain); this.gain.connect(context.destination)
      node.port.onmessage = ({ data }) => {
        if (this.disposed || data.playId !== this.playId) return
        if (data.type === 'position' || data.type === 'ended') this.position = Math.min(choirVideo.end, choirVideo.start + data.position)
        if (data.type === 'ended') { this.ended = true; this.playing = this.desired = false }
        changed()
      }
      node.onprocessorerror = () => { this.ready = this.playing = this.desired = false; report('음원 처리가 중단됐어요. 음원을 다시 불러와 주세요.'); changed() }
      this.pitchNode.onprocessorerror = node.onprocessorerror
      node.port.postMessage({ type: 'load', channels, sampleRate: decoded.sampleRate }, channels.map(channel => channel.buffer))
      this.ready = true; changed()
    } catch (error) {
      if (this.disposed) return
      this.node?.disconnect(); this.node = undefined; this.pitchNode?.disconnect(); this.pitchNode = undefined; this.gain?.disconnect(); this.gain = undefined; void this.context?.close(); this.context = undefined
      throw error
    }
  }
  start() {
    if (!this.ready) return
    this.generation++; this.ended = false; this.blocked = false; this.position = choirVideo.start; this.desired = this.playing = false
    this.node!.port.postMessage({ type: 'start', playId: ++this.playId }); this.node!.port.postMessage({ type: 'playing', value: false }); this.setPlaying(true)
  }
  setPlaying(playing: boolean) {
    if (!this.ready || this.ended || playing === this.desired || playing && this.blocked) return
    const generation = ++this.generation; this.desired = playing
    if (!playing) { this.playing = false; this.node!.port.postMessage({ type: 'playing', value: false }); this.gain!.gain.setTargetAtTime(0, this.context!.currentTime, .008); return }
    void this.context!.resume().then(() => {
      if (generation !== this.generation || this.disposed || !this.desired) return
      this.playing = true; this.gain!.gain.setTargetAtTime(.85, this.context!.currentTime, .008); this.node!.port.postMessage({ type: 'playing', value: true })
    }).catch(() => { if (generation === this.generation) { this.desired = this.playing = false; this.blocked = true; this.report?.('소리 재생이 차단됐어요. 노래 재생 허용 버튼을 눌러 주세요.') } })
  }
  allowPlayback() { this.blocked = false; this.desired = false; this.setPlaying(true) }
  setRate(rate: number) {
    this.rate = rate
    if (!this.node || rate === this.lastRate) return
    this.lastRate = rate; const param = this.node.parameters.get('tempo')!; param.cancelScheduledValues(this.context!.currentTime); param.setTargetAtTime(rate, this.context!.currentTime, .08)
    const mirror = this.pitchNode!.parameters.get('playbackRate')!; mirror.cancelScheduledValues(this.context!.currentTime); mirror.setTargetAtTime(rate, this.context!.currentTime, .08)
  }
  setPitch(semitones: number) {
    const value = Math.round(Math.max(-6, Math.min(6, semitones)) * 10) / 10
    if (!this.node || value === this.lastPitch) return
    this.lastPitch = value; const param = this.pitchNode!.parameters.get('pitchSemitones')!; param.cancelScheduledValues(this.context!.currentTime); param.setTargetAtTime(value, this.context!.currentTime, .1)
  }
  tap() {
    if (!this.context || this.context.state !== 'running') return
    const now = this.context.currentTime, oscillator = this.context.createOscillator(), gain = this.context.createGain()
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(700, now); oscillator.frequency.exponentialRampToValueAtTime(180, now + .045)
    gain.gain.setValueAtTime(.12, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .06)
    oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(); oscillator.stop(now + .07); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
  close() { this.disposed = true; this.generation++; this.cancel?.abort(); this.playing = this.ready = this.desired = false; this.node?.disconnect(); this.node?.port.close(); this.node = undefined; this.pitchNode?.disconnect(); this.pitchNode?.port.close(); this.pitchNode = undefined; this.gain?.disconnect(); this.gain = undefined; void this.context?.close(); this.context = undefined }
}
