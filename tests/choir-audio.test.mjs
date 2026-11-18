import { test } from 'node:test'
import assert from 'node:assert/strict'
const processors = new Map()
globalThis.sampleRate = 48000
globalThis.AudioWorkletProcessor = class { constructor() { this.messages = []; this.port = { postMessage: message => this.messages.push(message) } } }
globalThis.registerProcessor = (name, Processor) => processors.set(name, Processor)
await import('../public/choir-sampler.js')
await import('../public/vendor/soundtouch/processor.js')
function source(seconds = 2) {
  const reader = new (processors.get('choir-sampler'))()
  const data = Float32Array.from({ length: sampleRate * seconds }, (_, i) => Math.sin(2 * Math.PI * 440 * i / sampleRate) * .5)
  reader.port.onmessage({ data: { type: 'load', channels: [data, data], sampleRate } })
  reader.port.onmessage({ data: { type: 'start', playId: 7 } }); return reader
}
const block = () => [new Float32Array(128), new Float32Array(128)]
test('the audio cursor stops at the cropped end, freezes while paused, and restarts from the crop beginning', () => {
  const reader = source(.1), params = { tempo: [1.25] }
  reader.process([], [block()], params); const before = reader.cursor
  reader.port.onmessage({ data: { type: 'playing', value: false } })
  for (let i = 0; i < 10; i++) reader.process([], [block()], params)
  assert.equal(reader.cursor, before)
  reader.port.onmessage({ data: { type: 'playing', value: true } })
  for (let i = 0; i < 40; i++) reader.process([], [block()], params)
  const end = reader.messages.find(message => message.type === 'ended')
  assert.equal(end.position, .1); assert.equal(end.playId, 7); assert.equal(reader.running, false)
  reader.port.onmessage({ data: { type: 'start', playId: 8 } }); assert.equal(reader.cursor, 0)
})
function render(tempo, semitones) {
  const reader = source(3), shifter = new (processors.get('soundtouch-processor'))({})
  const params = { pitch: [1], pitchSemitones: [semitones], playbackRate: [tempo] }, result = []
  for (let i = 0; i < 560; i++) {
    const input = block(), output = block()
    reader.process([], [input], { tempo: [tempo] }); shifter.process([input], [output], params)
    if (i >= 180) result.push(...output[0])
  }
  assert.ok(result.every(Number.isFinite))
  assert.ok(result.reduce((sum, value) => sum + value * value, 0) / result.length > .01)
  let crossings = 0
  for (let i = 1; i < result.length; i++) if (result[i - 1] <= 0 && result[i] > 0) crossings++
  return crossings / (result.length / sampleRate)
}
test('real pitch DSP raises and lowers a tone while compensating for slow and fast source playback', () => {
  for (const [tempo, semitones] of [[1.25, 3], [.75, -3], [1.25, 0]]) {
    const frequency = render(tempo, semitones), expected = 440 * 2 ** (semitones / 12)
    assert.ok(Math.abs(frequency - expected) < expected * .025, `${tempo}×, ${semitones} semitones: ${frequency}Hz vs ${expected}Hz`)
  }
})
