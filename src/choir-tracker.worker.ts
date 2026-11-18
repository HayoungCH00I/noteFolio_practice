import { createChoirModels, detectChoirFrame, type ChoirModels } from './choir-vision.ts'
const scope = self as unknown as { onmessage: (event: MessageEvent) => void; postMessage(message: object): void; import(url: string): Promise<void>; ModuleFactory?: unknown }
scope.import = async url => { const wasm = await import(/* @vite-ignore */ url); scope.ModuleFactory = wasm.default }
let models: ChoirModels | undefined
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') { models = await createChoirModels(data.base, true); scope.postMessage({ type: 'ready' }) }
    else if (data.type === 'frame') {
      try { if (!models) throw new Error('Tracking is not ready'); scope.postMessage({ type: 'sample', sample: detectChoirFrame(models, data.bitmap, data.timestamp) }) }
      finally { data.bitmap.close() }
    }
  } catch (error) { scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Tracking failed' }) }
}
