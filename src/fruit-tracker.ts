import type { HandLandmarker, FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { SnowModels } from './snow-vision.ts'
import { createFruitModels, detectFruitFrame, type FruitModels, type TrackingSample } from './fruit-vision.ts'

export class FruitTracker {
  private worker?: Worker
  private models?: { hand: HandLandmarker; face?: FaceLandmarker; segment?: ImageSegmenter }
  private detect = (models: { hand: HandLandmarker; face?: FaceLandmarker }, image: HTMLVideoElement | ImageBitmap, timestamp: number, withFace: boolean): TrackingSample => detectFruitFrame(models as FruitModels, image, timestamp, withFace)
  private mode: 'fruit' | 'snow' | 'choir'
  private base = ''
  private closed = false
  private rejectInit?: (error: Error) => void
  private pending?: { resolve: (sample: TrackingSample) => void; reject: (error: Error) => void }
  constructor(mode: 'fruit' | 'snow' | 'choir' = 'fruit') { this.mode = mode }
  async init(base: string) {
    this.base = base
    let workerError: unknown
    if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
      try {
        await new Promise<void>((resolve, reject) => {
          const worker = this.mode === 'choir' ? new Worker(new URL('./choir-tracker.worker.ts', import.meta.url), { type: 'module' }) : this.mode === 'snow' ? new Worker(new URL('./snow-tracker.worker.ts', import.meta.url), { type: 'module' }) : new Worker(new URL('./fruit-tracker.worker.ts', import.meta.url), { type: 'module' })
          this.worker = worker
          const timeout = setTimeout(() => reject(new Error('Tracking worker unavailable')), 20000)
          this.rejectInit = error => { clearTimeout(timeout); reject(error) }
          worker.onmessage = ({ data }) => {
            if (data.type === 'ready') { clearTimeout(timeout); this.rejectInit = undefined; resolve() }
            else if (data.type === 'sample') { const pending = this.pending; this.pending = undefined; pending?.resolve(data.sample) }
            else if (data.type === 'error') { const error = new Error(data.message); this.rejectInit?.(error); this.pending?.reject(error); this.pending = undefined }
          }
          worker.onerror = () => { const error = new Error('Tracking worker interrupted'); this.rejectInit?.(error); this.pending?.reject(error); this.pending = undefined }
          worker.postMessage({ type: 'init', base })
        })
        return
      } catch (error) { workerError = error; this.rejectInit = undefined; this.worker?.terminate(); this.worker = undefined }
    }
    try { await this.fallback() }
    catch (error) {
      if (workerError && !this.closed) throw new AggregateError([workerError, error], '손 추적을 두 방식 모두에서 준비하지 못했어요.')
      throw error
    }
  }
  private async fallback() {
    if (this.closed) throw new Error('Tracking closed')
    let models: NonNullable<typeof this.models>
    if (this.mode === 'snow') {
      const snow = await import('./snow-vision.ts'); models = await snow.createSnowModels(this.base)
      this.detect = (models, image, timestamp, withFace) => snow.detectSnowFrame(models as SnowModels, image, timestamp, withFace)
    } else if (this.mode === 'choir') {
      const choir = await import('./choir-vision.ts'); models = await choir.createChoirModels(this.base)
      this.detect = (models, image, timestamp) => choir.detectChoirFrame(models, image, timestamp)
    } else models = await createFruitModels(this.base)
    if (this.closed) { models.hand.close(); models.face?.close(); models.segment?.close(); throw new Error('Tracking closed') }
    this.models = models
  }
  async sample(video: HTMLVideoElement, timestamp: number, withFace: boolean): Promise<TrackingSample> {
    if (this.closed) throw new Error('Tracking closed')
    if (this.worker) {
      try {
        const bitmap = await createImageBitmap(video)
        if (this.closed || !this.worker) { bitmap.close(); throw new Error('Tracking closed') }
        return await new Promise<TrackingSample>((resolve, reject) => {
          const timeout = setTimeout(() => { this.pending = undefined; reject(new Error('Tracking frame timed out')) }, 2000)
          this.pending = { resolve: sample => { clearTimeout(timeout); resolve(sample) }, reject: error => { clearTimeout(timeout); reject(error) } }
          try { this.worker!.postMessage({ type: 'frame', bitmap, timestamp, withFace }, [bitmap]) }
          catch (error) { bitmap.close(); clearTimeout(timeout); this.pending = undefined; reject(error) }
        })
      } catch (error) {
        if (this.closed) throw error
        this.worker?.terminate(); this.worker = undefined
        await this.fallback()
      }
    }
    return this.detect(this.models!, video, timestamp, withFace)
  }
  close() {
    this.closed = true; const error = new Error('Tracking closed')
    this.rejectInit?.(error); this.rejectInit = undefined; this.pending?.reject(error); this.pending = undefined
    this.worker?.terminate(); this.worker = undefined; this.models?.hand.close(); this.models?.face?.close(); this.models?.segment?.close(); this.models = undefined
  }
}
