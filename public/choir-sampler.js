// Read only the selected audio excerpt. Tempo moves this cursor; SoundTouch handles pitch downstream.
class ChoirSampler extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'tempo', defaultValue: 1, minValue: .5, maxValue: 1.5, automationRate: 'k-rate' }] }
  constructor() {
    super()
    this.channels = []; this.sourceRate = sampleRate; this.cursor = 0; this.running = false; this.elapsed = 0; this.playId = 0
    this.port.onmessage = ({ data }) => {
      if (data.type === 'load') { this.channels = data.channels; this.sourceRate = data.sampleRate; this.length = this.channels[0].length }
      if (data.type === 'start') { this.cursor = 0; this.playId = data.playId; this.running = true }
      if (data.type === 'playing') this.running = data.value && this.cursor < this.length
    }
  }
  process(_inputs, outputs, parameters) {
    const output = outputs[0]
    if (!this.running || !this.channels.length) return true
    const step = this.sourceRate / sampleRate * parameters.tempo[0]
    for (let frame = 0; frame < output[0].length; frame++) {
      if (this.cursor >= this.length) { this.running = false; this.port.postMessage({ type: 'ended', position: this.length / this.sourceRate, playId: this.playId }); break }
      const index = Math.floor(this.cursor), mix = this.cursor - index
      for (let channel = 0; channel < output.length; channel++) {
        const data = this.channels[channel % this.channels.length], next = data[Math.min(index + 1, this.length - 1)]
        output[channel][frame] = data[index] + (next - data[index]) * mix
      }
      this.cursor += step
    }
    this.elapsed += output[0].length
    if (this.elapsed >= sampleRate / 10) { this.elapsed = 0; this.port.postMessage({ type: 'position', position: Math.min(this.cursor, this.length) / this.sourceRate, playId: this.playId }) }
    return true
  }
}
registerProcessor('choir-sampler', ChoirSampler)
