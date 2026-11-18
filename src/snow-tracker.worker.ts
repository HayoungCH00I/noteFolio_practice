import { createSnowModels, detectSnowFrame, type SnowModels } from './snow-vision.ts'
const scope = self as unknown as { onmessage: (event: MessageEvent) => void; postMessage(message: object, transfer?: Transferable[]): void; import(url: string): Promise<void>; ModuleFactory?: unknown }
scope.import = async url => { const wasm = await import(/* @vite-ignore */ url); scope.ModuleFactory = wasm.default }
let models: SnowModels | undefined
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') { models = await createSnowModels(data.base, true); scope.postMessage({ type: 'ready' }) }
    else if (data.type === 'frame') {
      try {
        if (!models) throw new Error('Tracking is not ready')
        const sample = detectSnowFrame(models, data.bitmap, data.timestamp, data.withFace)
        scope.postMessage({ type: 'sample', sample }, sample.mask ? [sample.mask.data.buffer] : [])
      } finally { data.bitmap.close() }
    }
  } catch (error) { scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Tracking failed' }) }
}
