export function errorDetails(error: unknown): string {
  if (error instanceof AggregateError) return error.errors.map(errorDetails).join(' / ')
  if (error && typeof error === 'object') {
    const value = error as { name?: string; message?: string }
    return `${value.name && value.name !== 'Error' ? `${value.name}: ` : ''}${value.message || '알 수 없는 오류'}`
  }
  return String(error || '알 수 없는 오류')
}
export function cameraFailure(error: unknown, playback = false) {
  const name = error && typeof error === 'object' ? (error as { name?: string }).name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return playback ? '카메라 영상 재생이 차단됐어요. 카메라를 다시 켜 주세요.' : '브라우저와 기기 설정에서 카메라 권한을 허용해 주세요.'
  if (name === 'NotFoundError') return '연결된 카메라를 찾지 못했어요. 카메라 연결을 확인해 주세요.'
  if (name === 'NotReadableError' || name === 'TrackStartError') return '카메라를 열지 못했어요. 카메라를 사용하는 다른 앱을 종료하고 기기의 카메라 권한을 확인해 주세요.'
  if (name === 'OverconstrainedError') return '이 기기의 카메라 설정을 사용할 수 없어요. 다른 카메라를 선택하거나 브라우저를 다시 열어 주세요.'
  return `${playback ? '카메라 영상을 재생하지 못했어요.' : '카메라를 열지 못했어요.'} (${errorDetails(error).slice(0, 160)})`
}
export function trackingFailure(error: unknown) {
  const detail = errorDetails(error)
  const hint = /webgl|gpu|glcontext|getcontext/i.test(detail) ? '손 인식용 그래픽 기능을 시작하지 못했어요. 브라우저의 하드웨어 가속을 확인해 주세요.'
    : /fetch|network|load|import|certificate|ERR_CERT|404/i.test(detail) ? '손 인식 파일을 불러오지 못했어요. 인증서 경고가 없는지 확인하고 손 추적 다시 시도를 눌러 주세요.'
      : '카메라는 켜졌지만 손 인식을 준비하지 못했어요. 손 추적 다시 시도를 눌러 주세요.'
  return `${hint} (${detail.slice(0, 240)})`
}

export async function requestChoirCamera(request: (constraints: MediaStreamConstraints) => Promise<MediaStream>, facingMode: ConstrainDOMString = 'user') {
  try { return await request({ video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false }) }
  catch (error) {
    if (!error || typeof error !== 'object' || (error as { name?: string }).name !== 'OverconstrainedError') throw error
    return request({ video: { facingMode }, audio: false })
  }
}
