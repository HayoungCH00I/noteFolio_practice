import * as THREE from 'three'

export class TrainerAR {
  private layer: HTMLElement
  private preview: HTMLVideoElement
  private surface: HTMLButtonElement
  private place: HTMLButtonElement
  private avatar: HTMLElement
  private photo: HTMLImageElement
  private quickLook: HTMLAnchorElement
  private quickLookPhoto: HTMLImageElement
  private quickLookUrl?: string
  private status: HTMLElement
  private token = 0
  private stream?: MediaStream
  private session?: XRSession

  constructor(layer: HTMLElement) {
    this.layer = layer
    this.preview = layer.querySelector('video')!
    this.surface = layer.querySelector('.trainer-ar-surface')!
    this.place = layer.querySelector('.trainer-ar-place')!
    this.avatar = layer.querySelector('.trainer-ar-avatar')!
    this.photo = this.avatar.querySelector('img')!
    this.quickLook = layer.querySelector('.trainer-ar-quick-look')!
    this.quickLookPhoto = this.quickLook.querySelector('img')!
    this.status = layer.querySelector('[role="status"]')!
    layer.querySelector('.trainer-ar-close')!.addEventListener('click', () => this.close(true))
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.stream) this.close() })
    this.surface.addEventListener('click', event => {
      const rect = this.surface.getBoundingClientRect()
      this.avatar.style.left = event.detail ? `${(event.clientX - rect.left) / rect.width * 100}%` : '50%'
      this.avatar.style.top = event.detail ? `${(event.clientY - rect.top) / rect.height * 100}%` : '65%'
      this.avatar.hidden = false
      this.status.textContent = '배치했어요. 다른 위치를 누르면 옮길 수 있어요.'
    })
  }

  async show(name: string, photo: string) {
    this.close()
    const token = this.token
    this.layer.hidden = false
    this.layer.querySelector<HTMLButtonElement>('.trainer-ar-close')!.focus({ preventScroll: true })
    this.avatar.querySelector('strong')!.textContent = name
    this.photo.src = photo
    this.status.textContent = `${name}을(를) 꺼내는 중이에요.`
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (appleMobile || this.quickLook.relList.supports('ar')) {
      this.quickLookPhoto.src = photo
      this.quickLook.hidden = false
      this.status.textContent = 'AR 파일을 준비하고 있어요.'
      try {
        await this.prepareQuickLook(photo, token)
      } catch {
        if (token === this.token) this.status.textContent = 'AR 파일을 만들지 못했어요. 새로고침한 뒤 다시 시도해 주세요.'
      }
      return
    }
    if (navigator.xr) {
      try {
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test', 'dom-overlay'],
          domOverlay: { root: this.layer },
        })
        if (token !== this.token) { await session.end().catch(() => {}); return }
        this.session = session
        await this.world(session, token, name)
        return
      } catch {
        if (token !== this.token) return
        const session = this.session
        this.session = undefined
        await session?.end().catch(() => {})
      }
    }

    if (token !== this.token) return
    try { await this.photo.decode() } catch {
      if (token === this.token) this.status.textContent = '포획 사진을 불러오지 못했어요.'
      return
    }
    if (token !== this.token) return
    this.status.textContent = '카메라 화면 배치를 준비하고 있어요.'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (token !== this.token) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      this.preview.srcObject = stream
      this.preview.hidden = false
      await this.preview.play()
      if (token !== this.token) return
      this.surface.hidden = false
      this.status.textContent = `화면에서 ${name}을(를) 놓을 곳을 누르세요.`
    } catch {
      if (token !== this.token) return
      this.stream?.getTracks().forEach(track => track.stop())
      this.stream = undefined
      this.preview.srcObject = null
      this.preview.hidden = true
      this.status.textContent = '배치용 카메라를 열지 못했어요. 카메라 권한을 확인해 주세요.'
    }
  }

  close(restoreFocus = false) {
    this.token++
    const session = this.session
    this.session = undefined
    void session?.end().catch(() => {})
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = undefined
    this.preview.pause()
    this.preview.srcObject = null
    this.photo.removeAttribute('src')
    if (this.quickLookUrl) URL.revokeObjectURL(this.quickLookUrl)
    this.quickLookUrl = undefined
    this.quickLook.removeAttribute('href')
    this.quickLook.setAttribute('aria-disabled', 'true')
    this.quickLookPhoto.removeAttribute('src')
    this.quickLook.hidden = true
    this.layer.hidden = this.preview.hidden = this.surface.hidden = this.avatar.hidden = this.place.hidden = true
    this.layer.removeAttribute('data-world')
    if (restoreFocus) this.layer.parentElement?.querySelector<HTMLElement>('.trainer-boxes')?.focus({ preventScroll: true })
  }

  private async prepareQuickLook(photo: string, token: number) {
    const image = new Image()
    image.src = photo
    const [{ USDZExporter }] = await Promise.all([
      import('three/addons/exporters/USDZExporter.js'),
      image.decode(),
    ])
    if (token !== this.token) return

    const texture = new THREE.Texture(image)
    texture.colorSpace = THREE.SRGBColorSpace
    const scale = .9 / Math.max(image.naturalWidth, image.naturalHeight)
    const height = image.naturalHeight * scale
    const geometry = new THREE.PlaneGeometry(image.naturalWidth * scale, height)
    geometry.translate(0, height / 2, 0)
    const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 })
    try {
      const model = await new USDZExporter().parseAsync(new THREE.Mesh(geometry, material), { quickLookCompatible: true })
      if (token !== this.token) return
      this.quickLookUrl = URL.createObjectURL(new Blob([model], { type: 'model/vnd.usdz+zip' }))
      this.quickLook.href = this.quickLookUrl
      this.quickLook.removeAttribute('aria-disabled')
      this.status.textContent = 'AR로 열기를 누른 뒤 바닥이나 책상에 놓으세요.'
      this.quickLook.focus({ preventScroll: true })
    } finally {
      material.dispose()
      geometry.dispose()
      texture.dispose()
    }
  }

  private async world(session: XRSession, token: number, name: string) {
    await this.photo.decode()
    if (token !== this.token) return
    const viewer = await session.requestReferenceSpace('viewer')
    const hitSource = await session.requestHitTestSource?.({ space: viewer })
    if (!hitSource) throw new Error('Surface detection unavailable')
    if (token !== this.token) { hitSource.cancel(); return }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const reticle = new THREE.Mesh(new THREE.RingGeometry(.11, .135, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xaef2ce, side: THREE.DoubleSide }))
    reticle.visible = false
    scene.add(reticle)
    const texture = new THREE.Texture(this.photo)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    const figure = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false }))
    const scale = .9 / Math.max(this.photo.naturalWidth, this.photo.naturalHeight)
    figure.scale.set(this.photo.naturalWidth * scale, this.photo.naturalHeight * scale, 1)
    figure.center.set(.5, 0)
    figure.visible = false
    scene.add(figure)

    const place = () => {
      if (!reticle.visible) return
      figure.position.copy(reticle.position)
      figure.visible = true
      this.status.textContent = `${name}을(를) 배치했어요. 다른 곳을 조준해 옮길 수 있어요.`
    }
    const preventSelect = (event: Event) => { if ((event.target as Element).closest('button')) event.preventDefault() }
    const dispose = () => {
      renderer.setAnimationLoop(null)
      hitSource.cancel()
      this.place.removeEventListener('click', place)
      this.layer.removeEventListener('beforexrselect', preventSelect)
      session.removeEventListener('select', place)
      reticle.geometry.dispose()
      reticle.material.dispose()
      figure.material.dispose()
      texture.dispose()
      renderer.dispose()
      if (token === this.token && this.session === session) this.close(true)
    }
    try {
      const ready = renderer.xr.setSession(session)
      session.addEventListener('end', dispose, { once: true })
      await ready
    } catch (error) {
      session.removeEventListener('end', dispose)
      this.session = undefined
      await session.end().catch(() => {})
      dispose()
      throw error
    }
    if (token !== this.token) return
    this.layer.dataset.world = ''
    this.place.hidden = false
    this.place.addEventListener('click', place)
    this.layer.addEventListener('beforexrselect', preventSelect)
    session.addEventListener('select', place)
    this.status.textContent = '바닥이나 책상을 향해 카메라를 움직여 보세요.'
    renderer.setAnimationLoop((_time, frame) => {
      const space = renderer.xr.getReferenceSpace()
      const hit = frame && space && frame.getHitTestResults(hitSource)[0]?.getPose(space)
      reticle.visible = Boolean(hit)
      this.place.disabled = !hit
      if (hit) {
        const { x, y, z } = hit.transform.position
        reticle.position.set(x, y + .005, z)
        const { x: qx, y: qy, z: qz, w } = hit.transform.orientation
        reticle.quaternion.set(qx, qy, qz, w)
      }
      renderer.render(scene, camera)
    })
  }
}
