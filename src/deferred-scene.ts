type Scene = { setActive(active: boolean): void }
export function deferredScene(root: HTMLElement, load: () => Promise<Scene>): Scene {
  let scene: Scene | undefined, active = false, loading = false
  let notice: HTMLElement | undefined
  return { setActive(next: boolean) {
    active = next
    if (scene) { scene.setActive(active); return }
    if (!active || loading) return
    loading = true
    notice ??= document.createElement('p'); notice.className = 'scene-loading'; notice.textContent = '화면을 준비하고 있어요…'; root.append(notice)
    void load().then(loaded => { scene = loaded; notice?.remove(); scene.setActive(active) }).catch(() => { notice!.textContent = '화면을 불러오지 못했어요. 다른 페이지로 이동한 뒤 다시 열어 주세요.' }).finally(() => { loading = false })
  } }
}
