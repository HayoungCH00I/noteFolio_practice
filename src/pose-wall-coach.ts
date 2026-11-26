import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { PoseVerdict } from './pose-wall-core.ts'
import type { Figure, PosePreset } from './pose-wall-presets.ts'
import humanUrl from './assets/pose-wall-human.glb?url'

const colors = { waiting: 0xf4f2ee, ready: 0x68de94, adjust: 0xff776e }
const horizontal = new THREE.Vector3(1, 0, 0), towardCamera = new THREE.Vector3(0, 0, 1)

export class PoseWallCoach {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500)
  private readonly model: Awaited<ReturnType<typeof PoseWallCoach.load>>
  private figures: ReturnType<PoseWallCoach['makeFigure']>[]
  private preset?: PosePreset
  private started = 0
  private width = 0
  private height = 0
  private settled = false
  private lastColors = ''
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  static async load() {
    const { scene } = await new GLTFLoader().loadAsync(humanUrl)
    const model = scene.children.find(object => object instanceof THREE.SkinnedMesh)
    if (!model) throw new Error('The pose guide asset has no skinned mesh')
    const rest = (scene.userData.guidePoints as [number, number, number][]).map(point => new THREE.Vector3(...point))
    return { geometry: model.geometry, rest }
  }

  constructor(canvas: HTMLCanvasElement, model: Awaited<ReturnType<typeof PoseWallCoach.load>>) {
    this.model = model
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.scene.add(new THREE.HemisphereLight(0xf7fbff, 0x59615b, 1.05))
    const key = new THREE.DirectionalLight(0xfff4df, 2.0)
    key.position.set(-50, 75, 95)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xb2d4f0, .62)
    fill.position.set(65, 20, 35)
    this.scene.add(fill)
    this.figures = [this.makeFigure(), this.makeFigure()]
    this.scene.add(...this.figures)
  }

  private makeFigure() {
    const material = new THREE.MeshStandardMaterial({ color: colors.waiting, roughness: .78 })
    const mesh = new THREE.SkinnedMesh(this.model.geometry, material)
    const bones = Array.from({ length: 14 }, () => new THREE.Bone())
    mesh.add(...bones)
    this.applyBones(bones, this.model.rest)
    mesh.updateMatrixWorld(true)
    mesh.bind(new THREE.Skeleton(bones))
    mesh.frustumCulled = false
    return mesh
  }

  draw(preset: PosePreset, states: PoseVerdict[], now: number) {
    const canvas = this.renderer.domElement
    const width = canvas.clientWidth, height = canvas.clientHeight
    if (!width || !height) return
    const resized = this.width !== width || this.height !== height
    const changed = this.preset !== preset
    if (changed) { this.preset = preset; this.started = now; this.settled = false }
    const stateKey = states.join(',')
    if (!resized && !changed && this.settled && stateKey === this.lastColors) return
    if (resized || changed) {
      this.width = width
      this.height = height
      this.renderer.setSize(width, height, false)
      const xs = preset.figures.flat().map(([x]) => x)
      const center = (Math.max(...xs) + Math.min(...xs)) / 2
      const tallest = Math.min(...preset.figures.flat().map(([, y]) => y)) - 12
      const floor = 104, aspect = width / height
      const viewHeight = Math.max(floor - tallest + 6, (Math.max(...xs) - Math.min(...xs) + 28) / aspect)
      this.camera.left = -viewHeight * aspect / 2
      this.camera.right = viewHeight * aspect / 2
      this.camera.top = viewHeight / 2
      this.camera.bottom = -viewHeight / 2
      this.camera.position.set(center, -(floor + tallest) / 2, 220)
      this.camera.updateProjectionMatrix()
    }
    const motion = this.reducedMotion ? 1 : Math.min(1, (now - this.started) / 650)
    const blend = 1 - (1 - motion) ** 3
    this.figures.forEach((figure, index) => {
      const pose = preset.figures[index]
      figure.visible = Boolean(pose)
      if (!pose) return
      if (!this.settled) this.applyBones(figure.skeleton.bones, this.posePoints(pose, blend))
      figure.material.color.setHex(colors[states[index] ?? 'waiting'])
    })
    this.renderer.render(this.scene, this.camera)
    this.settled = motion === 1
    this.lastColors = stateKey
  }

  private posePoints(pose: Figure, blend: number) {
    const points = pose.map(([x, y]) => new THREE.Vector3(x, -y, 0))
    const { rest } = this.model
    const reachScale = THREE.MathUtils.clamp((106 - pose[0][1]) / 94, .8, 1.05)
    for (const shoulder of [1, 4]) {
      const direction = shoulder === 1 ? -1 : 1, anchor = points[shoulder]
      const elbow = points[shoulder + 1], wrist = points[shoulder + 2]
      elbow.z = 1.25
      wrist.z = 4.1
      const upper = elbow.clone().sub(anchor), lower = wrist.clone().sub(elbow)
      const upperLength = rest[shoulder].distanceTo(rest[shoulder + 1]) * reachScale
      const lowerLength = rest[shoulder + 1].distanceTo(rest[shoulder + 2]) * reachScale
      elbow.copy(anchor).add(upper.setLength(THREE.MathUtils.clamp(upper.length(), upperLength * .85, upperLength * 1.14)))
      wrist.copy(elbow).add(lower.setLength(THREE.MathUtils.clamp(lower.length(), lowerLength * .85, lowerLength * 1.14)))
      elbow.lerpVectors(anchor.clone().add(new THREE.Vector3(direction * 3.3, -upperLength, .5)), elbow, blend)
      wrist.lerpVectors(anchor.clone().add(new THREE.Vector3(direction * 4.8, -upperLength - lowerLength, 1.8)), wrist, blend)
    }
    points[8].z = points[11].z = .7
    return points
  }

  private applyBones(bones: THREE.Bone[], joints: THREE.Vector3[]) {
    const { rest } = this.model
    const hip = joints[7].clone().lerp(joints[10], .5)
    const shoulder = joints[1].clone().lerp(joints[4], .5)
    const tilt = new THREE.Quaternion()
    const align = (bone: THREE.Bone, anchor: THREE.Vector3, direction: THREE.Vector3, length = 1, width = 1) => {
      bone.position.copy(anchor)
      // Keep the limb's front facing the camera as it swings through vertical.
      const turn = Math.atan2(-direction.x, direction.y)
      const pitch = Math.atan2(direction.z, Math.hypot(direction.x, direction.y))
      bone.quaternion.setFromAxisAngle(towardCamera, turn).multiply(tilt.setFromAxisAngle(horizontal, pitch))
      bone.scale.set(width, length, 1)
    }
    align(bones[0], hip, shoulder.clone().sub(hip), hip.distanceTo(shoulder) / (rest[1].y - rest[7].y),
      THREE.MathUtils.clamp(Math.sqrt(joints[1].distanceTo(joints[4]) / rest[1].distanceTo(rest[4])), .85, 1.18))
    bones[1].position.copy(joints[0])
    for (let side = 0; side < 2; side++) {
      const arm = 1 + side * 3, leg = 7 + side * 3, bone = 2 + side * 6
      const link = (i: number, start: number) => {
        const direction = joints[start + 1].clone().sub(joints[start])
        const ratio = direction.length() / rest[start].distanceTo(rest[start + 1])
        align(bones[i], joints[start], direction, Math.max(.3, ratio))
      }
      link(bone, arm)
      link(bone + 1, arm + 1)
      align(bones[bone + 2], joints[arm + 2], joints[arm + 2].clone().sub(joints[arm + 1]))
      link(bone + 3, leg)
      link(bone + 4, leg + 1)
      bones[bone + 5].position.copy(joints[leg + 2])
    }
  }

  close() {
    this.model.geometry.dispose()
    this.figures.forEach(figure => { figure.material.dispose(); figure.skeleton.dispose() })
    this.renderer.dispose()
  }
}
