import { mkdir, copyFile } from 'node:fs/promises'

const processor = new URL(import.meta.resolve('@soundtouchjs/audio-worklet/processor'))
const destination = new URL('../public/vendor/soundtouch/', import.meta.url)
await mkdir(destination, { recursive: true })
await Promise.all([
  copyFile(processor, new URL('processor.js', destination)),
  copyFile(new URL('soundtouch-processor.js.map', processor), new URL('soundtouch-processor.js.map', destination)),
  copyFile(new URL('../LICENSE', processor), new URL('LICENSE', destination)),
])
