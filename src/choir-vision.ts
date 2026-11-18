import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { TrackingSample } from './fruit-vision.ts'
export type ChoirModels = { hand: HandLandmarker }
export async function createChoirModels(base: string, moduleWasm = false): Promise<ChoirModels> {
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(`${base}/wasm`, moduleWasm)
  const options = { runningMode: 'VIDEO' as const, numHands: 2, minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .55 }
  try { return { hand: await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/hand_landmarker.task`, delegate: 'GPU' } }) } }
  catch { return { hand: await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/hand_landmarker.task`, delegate: 'CPU' } }) } }
}
export function detectChoirFrame(models: ChoirModels, image: HTMLVideoElement | ImageBitmap, timestamp: number): TrackingSample {
  const result = models.hand.detectForVideo(image, timestamp)
  return { timestamp, landmarks: result.landmarks[0] ?? [], world: result.worldLandmarks[0] ?? [], hands: result.landmarks, handedness: result.handedness.map(categories => categories[0]?.categoryName ?? '') }
}
