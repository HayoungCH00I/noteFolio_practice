import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { BodyMask } from './pose-wall-opening.ts'
import { trackedBody, type BodyPose } from './pose-wall-core.ts'
import type { PlayerCount } from './pose-wall-presets.ts'

export async function createPoseWallModel(base: string, players: PlayerCount) {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const runtime = await FilesetResolver.forVisionTasks(`${base}/wasm`)
  const modelAssetPath = `${base}/models/pose_landmarker_lite.task`
  // GPU readback can return an empty mask even when pose landmarks are valid.
  return PoseLandmarker.createFromOptions(runtime, {
    runningMode: 'VIDEO', numPoses: players, outputSegmentationMasks: true,
    baseOptions: { modelAssetPath, delegate: 'CPU' },
  })
}

export function readBodies(model: PoseLandmarker, frame: HTMLCanvasElement, timestamp: number) {
  const bodies: BodyPose[] = []
  model.detectForVideo(frame, timestamp, result => {
    result.landmarks.forEach((landmarks, index) => {
      const body = trackedBody(landmarks)
      if (!body) return
      const mask = result.segmentationMasks?.[index]
      if (mask) body.mask = readMask(mask)
      bodies.push(body)
    })
  })
  return bodies
}

function readMask(mask: { width: number; height: number; getAsFloat32Array(): Float32Array }): BodyMask | undefined {
  const source = mask.getAsFloat32Array()
  const width = Math.min(240, mask.width)
  const height = Math.max(1, Math.round(width * mask.height / mask.width))
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.floor((x + .5) * mask.width / width)
    const sy = Math.floor((y + .5) * mask.height / height)
    data[y * width + x] = Math.round(255 * Math.min(1, Math.max(0, (source[sy * mask.width + sx] - .25) / .5)))
  }
  if (data.some(Boolean)) return { width, height, data }
}
