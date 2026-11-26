import * as THREE from 'three'
import swordUrl from './assets/minecraft-sword.png'

export async function createSword() {
  const image = new Image(); image.src = swordUrl; await image.decode()
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height), width = canvas.width, height = canvas.height
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter
  const sword = new THREE.Group(), plane = new THREE.PlaneGeometry(1, 1); plane.translate(.5 - .16, .5 - .13, 0)
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .1, side: THREE.DoubleSide })
  for (const z of [-.045, .045]) { const surface = new THREE.Mesh(plane, material); surface.position.z = z; sword.add(surface) }
  const positions: number[] = [], colors: number[] = [], depth = .045
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3]! > 40
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (opaque(x, y)) {
    const i = (y * width + x) * 4, x0 = x / width - .16, x1 = (x + 1) / width - .16, y0 = 1 - y / height - .13, y1 = 1 - (y + 1) / height - .13
    const edge = (ax: number, ay: number, bx: number, by: number) => {
      positions.push(ax, ay, -depth, bx, by, -depth, ax, ay, depth, bx, by, -depth, bx, by, depth, ax, ay, depth)
      for (let k = 0; k < 6; k++) colors.push(data[i]! / 255 * .7, data[i + 1]! / 255 * .7, data[i + 2]! / 255 * .7)
    }
    if (!opaque(x - 1, y)) edge(x0, y0, x0, y1)
    if (!opaque(x + 1, y)) edge(x1, y1, x1, y0)
    if (!opaque(x, y - 1)) edge(x1, y0, x0, y0)
    if (!opaque(x, y + 1)) edge(x0, y1, x1, y1)
  }
  const sides = new THREE.BufferGeometry(); sides.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); sides.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  sword.add(new THREE.Mesh(sides, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })))
  return sword
}
