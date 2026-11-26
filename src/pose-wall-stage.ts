import * as THREE from 'three'
import type { PoseWallRound } from './pose-wall-core.ts'
import type { WallOpening } from './pose-wall-opening.ts'

const impactDistance = 4
const depth = .21

export class PoseWallStage {
  private renderer: THREE.WebGLRenderer
  private camera = new THREE.PerspectiveCamera(41, 1, .1, 35)
  private scene = new THREE.Scene()
  private wall = new THREE.Group()
  private opening?: WallOpening
  private texture?: THREE.DataTexture
  private area = new THREE.Vector4()
  private contour = new Path2D()
  private outline: CanvasRenderingContext2D
  private front = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.6, depth), new THREE.ShaderMaterial({
    uniforms: {
      opening: { value: null },
      openingArea: { value: this.area },
      texel: { value: new THREE.Vector2() },
      fade: { value: 1 },
    },
    transparent: true,
    vertexShader: `
      varying vec3 localPosition;
      varying vec3 localNormal;
      void main() {
        localPosition = position;
        localNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D opening;
      uniform vec4 openingArea;
      uniform vec2 texel;
      uniform float fade;
      varying vec3 localPosition;
      varying vec3 localNormal;

      float aperture(vec2 uv) {
        if (min(uv.x, uv.y) < 0. || max(uv.x, uv.y) >= 1.) return 0.;
        return texture2D(opening, uv).r;
      }

      void main() {
        vec2 uv = vec2(localPosition.x - openingArea.x, openingArea.y - localPosition.y) / openingArea.zw;
        if (aperture(uv) > .5) discard;
        vec2 tile = localPosition.xy / vec2(.148, .066);
        tile.x += .5 * mod(floor(tile.y), 2.);
        vec2 cell = fract(tile);
        vec2 edgeDistance = min(cell, 1. - cell);
        float mortar = smoothstep(.025, .065, min(edgeDistance.x * 1.7, edgeDistance.y));
        float grain = fract(sin(dot(floor(localPosition.xy * 550.), vec2(12.9898, 78.233))) * 43758.5453);
        float brickTone = fract(sin(dot(floor(tile), vec2(39.34, 11.13))) * 12345.78);
        vec3 brick = mix(vec3(.25, .066, .036), vec3(.68, .275, .135), brickTone * .75 + .18);
        brick += (grain - .5) * .035 + (.5 - cell.y) * .045;
        vec3 color = mix(vec3(.106, .117, .101), brick, mortar) * (.69 + .31 * abs(localNormal.z));
        float border = max(max(aperture(uv + vec2(texel.x, 0.)), aperture(uv - vec2(texel.x, 0.))),
                           max(aperture(uv + vec2(0., texel.y)), aperture(uv - vec2(0., texel.y))));
        color = mix(color, vec3(.97, .63, .24), border * .83);
        gl_FragColor = vec4(color, fade);
        #include <colorspace_fragment>
      }
    `,
  }))
  private rim = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x6b4231, side: THREE.DoubleSide, transparent: true }))
  private size = new THREE.Vector2()
  private imageWidth = 0
  private imageHeight = 0

  constructor(canvas: HTMLCanvasElement, outline: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.outline = outline.getContext('2d')!
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
    this.renderer.setClearColor(0, 0)
    this.wall.add(this.front, this.rim)
    this.scene.add(this.wall)
  }

  draw(round: PoseWallRound, width: number, height: number, imageWidth: number, imageHeight: number) {
    const { opening, phase, progress } = round
    if (!opening || (phase !== 'wall' && phase !== 'passing')) {
      if (this.opening) {
        this.opening = undefined
        this.renderer.clear()
        this.outline.clearRect(0, 0, this.outline.canvas.width, this.outline.canvas.height)
      }
      return
    }
    if (width <= 0 || height <= 0 || !imageWidth || !imageHeight) return
    const resized = width !== this.size.x || height !== this.size.y || imageWidth !== this.imageWidth || imageHeight !== this.imageHeight
    const fit = Math.min(width / imageWidth, height / imageHeight)
    const fittedWidth = imageWidth * fit, fittedHeight = imageHeight * fit
    if (resized) {
      this.size.set(width, height)
      this.imageWidth = imageWidth
      this.imageHeight = imageHeight
      this.renderer.setSize(width, height, false)
      this.outline.canvas.width = this.renderer.domElement.width
      this.outline.canvas.height = this.renderer.domElement.height
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
    if (opening !== this.opening || resized) this.setOpening(opening, fittedWidth / height, fittedHeight / height)
    const passing = phase === 'passing'
    const distance = passing ? THREE.MathUtils.lerp(impactDistance, 1.15, progress)
      : THREE.MathUtils.lerp(24, impactDistance, progress)
    const span = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const sizeAtImpact = (impactDistance - depth / 2) * span
    this.wall.scale.set(sizeAtImpact, sizeAtImpact, 1)
    this.wall.position.z = -distance
    const fade = passing ? Math.min(1, (1 - progress) / .38) : 1
    this.front.material.uniforms.fade.value = fade * .8
    this.rim.material.opacity = fade * .8
    this.renderer.render(this.scene, this.camera)
    const perspective = (impactDistance - depth / 2) / (distance - depth / 2)
    const projectedWidth = fittedWidth * perspective, projectedHeight = fittedHeight * perspective
    const ratio = this.renderer.getPixelRatio()
    const outline = this.outline
    outline.clearRect(0, 0, outline.canvas.width, outline.canvas.height)
    outline.save()
    outline.translate(((width - projectedWidth) / 2 + opening.left * projectedWidth) * ratio,
      ((height - projectedHeight) / 2 + opening.top * projectedHeight) * ratio)
    const cellWidth = projectedWidth / opening.frameWidth, cellHeight = projectedHeight / opening.frameHeight
    outline.scale(cellWidth * ratio, cellHeight * ratio)
    outline.globalAlpha = fade
    outline.lineJoin = outline.lineCap = 'round'
    outline.lineWidth = 4 / cellWidth
    outline.strokeStyle = '#2e1c10c9'
    outline.stroke(this.contour)
    outline.lineWidth = 1.8 / cellWidth
    outline.strokeStyle = '#ffda87'
    outline.stroke(this.contour)
    outline.restore()
  }

  private setOpening(opening: WallOpening, imageWidth: number, imageHeight: number) {
    this.opening = opening
    const { data, width, height, left, top, frameWidth, frameHeight } = opening
    this.texture?.dispose()
    this.texture = new THREE.DataTexture(data, width, height, THREE.RedFormat)
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter
    this.texture.needsUpdate = true
    this.front.material.uniforms.opening.value = this.texture
    this.front.material.uniforms.texel.value.set(1.5 / width, 1.5 / height)
    const cellWidth = imageWidth / frameWidth, cellHeight = imageHeight / frameHeight
    const minX = (left - .5) * imageWidth, maxY = (.5 - top) * imageHeight
    this.area.set(minX, maxY, width * cellWidth, height * cellHeight)

    const vertices: number[] = []
    this.contour = new Path2D()
    const edge = (x1: number, y1: number, x2: number, y2: number) => {
      this.contour.moveTo(x1, y1)
      this.contour.lineTo(x2, y2)
      const ax = minX + x1 * cellWidth, ay = maxY - y1 * cellHeight
      const bx = minX + x2 * cellWidth, by = maxY - y2 * cellHeight
      const front = depth / 2, back = -front
      vertices.push(ax, ay, front, bx, by, front, ax, ay, back, ax, ay, back, bx, by, front, bx, by, back)
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!data[i]) continue
      if (!x || !data[i - 1]) edge(x, y, x, y + 1)
      if (x === width - 1 || !data[i + 1]) edge(x + 1, y, x + 1, y + 1)
      if (!y || !data[i - width]) edge(x, y, x + 1, y)
      if (y === height - 1 || !data[i + width]) edge(x, y + 1, x + 1, y + 1)
    }
    this.rim.geometry.dispose()
    this.rim.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  }

  close() {
    this.texture?.dispose()
    this.front.geometry.dispose()
    this.front.material.dispose()
    this.rim.geometry.dispose()
    this.rim.material.dispose()
    this.renderer.dispose()
  }
}
