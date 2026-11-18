import type { FaceLandmarker, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
export type FruitModels = { hand: HandLandmarker; face: FaceLandmarker }
export type TrackingSample = { timestamp: number; landmarks: NormalizedLandmark[]; world: NormalizedLandmark[]; faces?: NormalizedLandmark[]; hands?: NormalizedLandmark[][]; handedness?: string[]; mask?: { width: number; height: number; data: Uint8Array } }
export async function createFruitModels(base: string, moduleWasm = false): Promise<FruitModels> {
  const { FilesetResolver, HandLandmarker, FaceLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(`${base}/wasm`, moduleWasm)
  let hand: HandLandmarker | undefined
  try {
    const options = { runningMode: 'VIDEO' as const, numHands: 1, minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .55 }
    try { hand = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/hand_landmarker.task`, delegate: 'GPU' } }) }
    catch { hand = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${base}/models/hand_landmarker.task`, delegate: 'CPU' } }) }
    const faceOptions = { runningMode: 'VIDEO' as const, numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false }
    let face: FaceLandmarker
    try { face = await FaceLandmarker.createFromOptions(vision, { ...faceOptions, baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate: 'GPU' } }) }
    catch { face = await FaceLandmarker.createFromOptions(vision, { ...faceOptions, baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate: 'CPU' } }) }
    return { hand, face }
  } catch (error) { hand?.close(); throw error }
}
export function detectFruitFrame(models: FruitModels, image: HTMLVideoElement | ImageBitmap, timestamp: number, withFace: boolean): TrackingSample {
  const result = models.hand.detectForVideo(image, timestamp)
  return { timestamp, landmarks: result.landmarks[0] ?? [], world: result.worldLandmarks[0] ?? result.landmarks[0] ?? [], faces: withFace ? models.face.detectForVideo(image, timestamp).faceLandmarks[0] ?? [] : undefined }
}

