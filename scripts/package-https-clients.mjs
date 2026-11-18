import { execFileSync } from 'node:child_process'
import { createHash, X509Certificate } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { isIP } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { certificateHosts } from './setup-dev-https.mjs'

export function clientInstallers(sha256, address) {
  const url = new URL(address)
  if (!/^[a-f0-9]{64}$/.test(sha256) || url.protocol !== 'https:' || isIP(url.hostname) !== 4 || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('인증서 해시 또는 HTTPS LAN 주소가 올바르지 않아요.')
  const mac = `#!/bin/bash
set -euo pipefail
bundle_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
echo "이 Mac에 노트폴리오 로컬 개발 인증서를 신뢰 등록합니다."
echo "관리자 승인 창이 뜨면 승인해 주세요. 서버를 설치하거나 실행하지 않습니다."
actual=$(/usr/bin/shasum -a 256 < "$bundle_dir/rootCA.pem")
actual="\${actual%% *}"
if [ "$actual" != "${sha256}" ]; then
  echo "인증서가 원본과 다릅니다. 설치를 중단합니다."
  exit 1
fi
/usr/bin/osascript - "$bundle_dir/rootCA.pem" <<'APPLESCRIPT'
on run argv
  set certificatePath to item 1 of argv
  do shell script "/usr/bin/security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain " & quoted form of certificatePath with administrator privileges
end run
APPLESCRIPT
echo "인증서 등록 완료. 브라우저를 완전히 재시작하면 등록이 반영됩니다."
/usr/bin/open "${url.href}"
`
  const windows = `@echo off
chcp 65001 >nul
setlocal
set "CERT_SETUP_DIR=%~dp0"
echo 이 계정에 노트폴리오 로컬 개발 인증서를 신뢰 등록합니다.
echo 보안 승인 창이 나타나면 승인해 주세요. 서버를 설치하거나 실행하지 않습니다.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $cert=Join-Path $env:CERT_SETUP_DIR 'rootCA.pem'; if ((Get-FileHash -LiteralPath $cert -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${sha256}') { Write-Error 'Certificate integrity check failed'; exit 1 }; & certutil.exe -user -addstore Root $cert; exit $LASTEXITCODE"
if errorlevel 1 (
  echo 인증서 설치에 실패했습니다. 위 오류를 확인해 주세요.
  pause
  exit /b 1
)
echo 인증서 등록 완료. 브라우저를 완전히 재시작하면 등록이 반영됩니다.
start "" "${url.href}"
pause
`
  const readme = `로컬 HTTPS 인증서 자동 설치

1. ZIP 압축을 완전히 풀어 주세요. ZIP 안에서 바로 실행하지 마세요.
2. Mac은 Mac-HTTPS-Setup.command, Windows는 Windows-HTTPS-Setup.cmd를 실행하세요.
3. 관리자 비밀번호 또는 보안 승인 창이 나타나면 직접 승인하세요.
4. 등록이 끝나면 프로젝트 주소가 열립니다. 기존 브라우저에 경고가 남으면 브라우저를 완전히 종료했다 다시 여세요.
5. 페이지에서 카메라 켜기를 누르고 카메라 사용을 허용하세요.

공유 주소: ${url.href}
서버를 실행하는 PC와 같은 Wi-Fi 또는 유선 LAN에 연결해야 합니다.
서버 주인은 npm run dev를 실행해야 합니다. 이 설치 파일은 서버를 실행하지 않습니다.

원본을 전달한 사람을 확인한 뒤 실행하세요. 이 파일은 해당 개발용 루트 인증서를 기기의 신뢰 저장소에 등록합니다.
Mac에서 실행이 차단되면 이 프로젝트의 HTTPS_DEV.md에 있는 수동 신뢰 등록 방법을 사용할 수 있습니다.
회사 관리 PC에서 보안 정책으로 차단되면 관리자의 도움이 필요할 수 있습니다.
Firefox에서만 경고가 남으면 인증서 관리자에 rootCA.pem을 인증 기관으로 가져와 주세요.

포함된 인증서는 공개 루트 인증서뿐입니다. 서버 비밀키나 CA 비밀키는 포함하지 않습니다.
인증서 파일 SHA-256: ${sha256}
`
  return { 'Mac-HTTPS-Setup.command': mac, 'Windows-HTTPS-Setup.cmd': windows.replaceAll('\n', '\r\n'), 'README.txt': readme }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const directory = new URL('../.certs/', import.meta.url)
    const root = readFileSync(new URL('rootCA.pem', directory))
    if (root.includes('PRIVATE KEY') || !new X509Certificate(root).ca) throw new Error('공개 루트 인증서만 포함할 수 있어요.')
    const host = certificateHosts()[3]
    if (!host && !process.argv[2]) throw new Error('현재 LAN IP를 찾지 못했어요.')
    const address = process.argv[2] ?? `https://${host}:5173/`
    const files = clientInstallers(createHash('sha256').update(root).digest('hex'), address)
    if (!new X509Certificate(readFileSync(new URL('dev-cert.pem', directory))).checkIP(new URL(address).hostname)) throw new Error('공유 주소가 개발 인증서에 없어요. npm run certs로 먼저 재발급하세요.')
    const bundle = new URL('client-setup/', directory)
    mkdirSync(bundle, { recursive: true, mode: 0o700 })
    writeFileSync(new URL('rootCA.pem', bundle), root)
    for (const [name, content] of Object.entries(files)) writeFileSync(new URL(name, bundle), content, { mode: name.endsWith('.command') ? 0o755 : 0o644 })
    const zip = new URL('client-setup.zip', directory)
    const staging = mkdtempSync(fileURLToPath(new URL('client-stage-', directory)))
    try {
      const cleanBundle = pathToFileURL(`${staging}/client-setup/`)
      mkdirSync(cleanBundle)
      writeFileSync(new URL('rootCA.pem', cleanBundle), root)
      for (const [name, content] of Object.entries(files)) writeFileSync(new URL(name, cleanBundle), content, { mode: name.endsWith('.command') ? 0o755 : 0o644 })
      execFileSync('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--keepParent', fileURLToPath(cleanBundle), fileURLToPath(zip)])
    } finally { rmSync(staging, { recursive: true, force: true }) }
    console.log(`공유용 설치 ZIP: ${fileURLToPath(zip)}`)
    console.log(`설치 후 접속 주소: ${address}`)
    console.log('공개 루트 인증서와 Mac·Windows 설치 파일만 포함했습니다. 설치 및 개발 서버 실행은 하지 않았습니다.')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
