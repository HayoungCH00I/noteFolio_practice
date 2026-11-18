import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChoirMusic } from '../src/choir-music.ts'
const contexts = [], nodes = []
class Param {
  value = 0; updates = 0
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; this.updates++ }
}
let decode = async () => ({ duration: 139, sampleRate: 1000, numberOfChannels: 2, getChannelData: () => Float32Array.from({ length: 139000 }, (_, i) => i / 1000) })
class Context {
  currentTime = 0; state = 'suspended'; resumes = 0
  destination = {}; audioWorklet = { addModule: async () => {} }
  constructor() { contexts.push(this) }
  decodeAudioData() { return decode() }
  createGain() { return { gain: new Param(), connect() {}, disconnect() {} } }
  async resume() { this.resumes++; this.state = 'running' }
  async close() { this.state = 'closed' }
}
class Node {
  constructor(context, name) {
    this.name = name; this.parameters = new Map(['tempo', 'playbackRate', 'pitchSemitones'].map(name => [name, new Param()]))
    this.messages = []; this.port = { postMessage: message => this.messages.push(message), close() {} }; nodes.push(this)
  }
  connect() {}
  disconnect() { this.disconnected = true }
}
globalThis.AudioContext = Context; globalThis.AudioWorkletNode = Node
globalThis.location = { href: 'http://localhost:5173/' }
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })
const flush = () => new Promise(resolve => setImmediate(resolve))
async function music() { const result = new ChoirMusic(); await result.init(() => {}, () => {}); return result }
test('the local audio is cropped to precisely 18–112 seconds before playback', async () => {
  const song = await music(), source = nodes.at(-2), load = source.messages[0]
  assert.equal(load.type, 'load'); assert.equal(load.channels[0].length, 94000)
  assert.equal(load.channels[0][0], 18); assert.ok(Math.abs(load.channels[0].at(-1) - 111.999) < .0001)
  song.start(); await flush(); assert.equal(song.playing, true)
  source.port.onmessage({ data: { type: 'ended', position: 94, playId: 1 } })
  assert.equal(song.position, 112); assert.equal(song.ended, true); assert.equal(song.playing, false)
  song.close(); assert.equal(contexts.at(-1).state, 'closed')
})
test('pitch changes do not change playback tempo or source position; releasing resets pitch', async () => {
  const song = await music(), source = nodes.at(-2), pitch = nodes.at(-1)
  song.setRate(1.25); song.setPitch(5)
  assert.equal(source.parameters.get('tempo').value, 1.25)
  assert.equal(pitch.parameters.get('playbackRate').value, 1.25)
  assert.equal(pitch.parameters.get('pitchSemitones').value, 5)
  assert.equal(song.position, 18)
  song.setPitch(0); assert.equal(pitch.parameters.get('pitchSemitones').value, 0)
  const updates = pitch.parameters.get('pitchSemitones').updates
  for (let i = 0; i < 60; i++) song.setPitch(0)
  assert.equal(pitch.parameters.get('pitchSemitones').updates, updates); song.close()
})
test('pause and resume keep the source cursor instead of restarting the excerpt', async () => {
  const song = await music(), source = nodes.at(-2); song.start(); await flush()
  source.port.onmessage({ data: { type: 'position', position: 12, playId: 1 } })
  song.setPlaying(false); song.setPlaying(true); await flush()
  assert.equal(song.position, 30); assert.equal(source.messages.filter(message => message.type === 'start').length, 1)
  song.start(); await flush(); source.port.onmessage({ data: { type: 'ended', position: 94, playId: 1 } })
  assert.equal(song.ended, false); assert.equal(song.position, 18); song.close()
})
test('leaving while audio decoding finishes closes the context without creating live nodes', async () => {
  const original = decode; let finish
  decode = () => new Promise(resolve => { finish = resolve })
  const song = new ChoirMusic(), before = nodes.length, pending = song.init(() => {}, () => {})
  await flush(); song.close(); finish({ duration: 139 }); await pending
  assert.equal(nodes.length, before); assert.equal(contexts.at(-1).state, 'closed'); decode = original
})
test('a missing or too-short audio file shows a recoverable loading error and closes audio', async () => {
  const original = decode; decode = async () => ({ duration: 90 })
  const song = new ChoirMusic(); await assert.rejects(song.init(() => {}, () => {}), /1:52/)
  assert.equal(song.ready, false); assert.equal(contexts.at(-1).state, 'closed'); song.close(); decode = original
})
test('a blocked audio resume reports recovery once and can be retried by a click', async () => {
  const messages = [], song = new ChoirMusic(); await song.init(message => messages.push(message), () => {})
  const context = contexts.at(-1); context.resume = async () => { context.resumes++; throw new Error('blocked') }
  song.start(); await flush(); for (let i = 0; i < 20; i++) song.setPlaying(true)
  assert.equal(context.resumes, 1); assert.match(messages[0], /차단/)
  context.resume = Context.prototype.resume; song.allowPlayback(); await flush(); assert.equal(song.playing, true); song.close()
})
