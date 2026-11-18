import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChoirScoldPrompt } from '../src/choir-scold-prompt.ts'

test('three continuous seconds of poor singing prompts a random singer; a good interval resets the timer', () => {
  const prompt = new ChoirScoldPrompt(() => .6)
  prompt.advance(2.9, true, false, -1); assert.equal(prompt.active, false)
  prompt.advance(1, true, true, -1); prompt.advance(2, true, false, -1); assert.equal(prompt.active, false)
  assert.equal(prompt.advance(1, true, false, -1), 'started'); assert.equal(prompt.target, 2)
})
test('a prompt expires after five singing seconds and leaves fifteen singing seconds before another attempt', () => {
  const prompt = new ChoirScoldPrompt(() => 0)
  prompt.advance(3, true, false, -1); prompt.advance(4.9, true, false, -1)
  assert.equal(prompt.target, 0); assert.equal(prompt.advance(.11, true, false, -1), 'finished'); assert.equal(prompt.active, false)
  prompt.advance(14, true, false, -1); assert.equal(prompt.active, false)
  prompt.advance(1, true, false, -1); assert.equal(prompt.active, false)
  prompt.advance(2.9, true, false, -1); assert.equal(prompt.active, false)
  assert.equal(prompt.advance(.11, true, false, -1), 'started')
})
test('pauses and good ratings cancel prompts; inactive time cannot accumulate a new invitation', () => {
  for (const [singing, good] of [[false, false], [true, true]]) {
    const prompt = new ChoirScoldPrompt(() => .99)
    prompt.advance(3, true, false, -1); assert.equal(prompt.target, 3)
    assert.equal(prompt.advance(.1, singing, good, -1), 'finished'); assert.equal(prompt.active, false)
  }
  const prompt = new ChoirScoldPrompt()
  prompt.advance(2.5, true, false, -1); prompt.advance(100, false, false, -1)
  prompt.advance(2.9, true, false, -1); assert.equal(prompt.active, false)
})
test('only scolding the requested singer completes the invitation; restart clears its result and timers', () => {
  const prompt = new ChoirScoldPrompt(() => .6)
  prompt.advance(3, true, false, -1); prompt.advance(.1, true, false, 1)
  assert.equal(prompt.active, true)
  assert.equal(prompt.advance(.1, true, false, 2), 'finished'); assert.equal(prompt.succeeded, true)
  prompt.advance(.1, true, false, 2); assert.equal(prompt.succeeded, true)
  prompt.advance(.1, true, false, -1); assert.equal(prompt.succeeded, false)
  prompt.reset(); assert.equal(prompt.active, false); assert.equal(prompt.succeeded, false)
  assert.equal(prompt.advance(3, true, false, -1), 'started')
})
test('an existing manual selection or scolding is not interrupted by an automatic invitation', () => {
  const prompt = new ChoirScoldPrompt()
  prompt.advance(3, true, false, -1, true); assert.equal(prompt.active, false)
  prompt.advance(2.9, true, false, -1); assert.equal(prompt.active, false)
  assert.equal(prompt.advance(.11, true, false, -1), 'started')
})
