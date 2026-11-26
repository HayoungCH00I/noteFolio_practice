import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import { createFruitModels, detectFruitFrame, type FruitModels, type TrackingSample } from './fruit-vision.ts'
export type SnowModels = FruitModels & { segment: ImageSegmenter }
export async function createSnowModels(base: string, moduleWasm = false): Promise<SnowModels> {
  const models = await createFruitModels(base, moduleWasm)
  try {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(`${base}/wasm`, moduleWasm)
    const options = { runningMode: 'VIDEO' as const, outputCategoryMask: true, outputConfidenceMasks: false }
    let segment: ImageSegmenter
    try { segment = await ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/selfie_segmenter.tflite`, delegate: 'GPU' } }) }
    catch { segment = await ImageSegmenter.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/selfie_segmenter.tflite`, delegate: 'CPU' } }) }
    return { ...models, segment }
  } catch (error) { models.hand.close(); models.face.close(); throw error }
}
export function detectSnowFrame(models: SnowModels, image: HTMLVideoElement | ImageBitmap, timestamp: number, withFace: boolean): TrackingSample {
  const sample = detectFruitFrame(models, image, timestamp, withFace)
  if (withFace) models.segment.segmentForVideo(image, timestamp, result => {
    const mask = result.categoryMask
    if (!mask) return
    const source = mask.getAsUint8Array(), width = Math.min(256, mask.width), height = Math.max(1, Math.round(mask.height / mask.width * width)), data = new Uint8Array(width * height)
    // This single-class model returns category 0 for selfie pixels and 255 for background.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = source[Math.floor(y / height * mask.height) * mask.width + Math.floor(x / width * mask.width)] === 0 ? 1 : 0
    sample.mask = { width, height, data }
  })
  return sample
}
