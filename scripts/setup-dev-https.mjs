import { execFileSync } from 'node:child_process'
import { mkdirSync, chmodSync, copyFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'

export function certificateHosts(interfaces = networkInterfaces()) {
  const addresses = Object.values(interfaces).flat().filter(address => address && !address.internal && (address.family === 'IPv4' || address.family === 4)).map(address => address.address)
  return [...new Set(['localhost', '127.0.0.1', '::1', ...addresses])]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const directory = fileURLToPath(new URL('../.certs/', import.meta.url)), hosts = certificateHosts()
    mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700)
    execFileSync('mkcert', ['-cert-file', join(directory, 'dev-cert.pem'), '-key-file', join(directory, 'dev-key.pem'), ...hosts], { stdio: 'inherit' })
    chmodSync(join(directory, 'dev-key.pem'), 0o600)
    const caRoot = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim()
    copyFileSync(join(caRoot, 'rootCA.pem'), join(directory, 'rootCA.pem'))
    console.log('인증서를 .certs/에 생성했습니다. rootCA.pem만 접속할 기기에 전달하세요.')
    console.log('신뢰 등록: mkcert -install (현재 PC에서 한 번 실행)')
    for (const host of hosts.slice(3)) console.log(`개발 서버 실행 후 공유 주소: https://${host}:5173/ (실제 Network 출력의 포트 확인)`)
  } catch (error) {
    console.error(error.code === 'ENOENT' ? 'mkcert를 찾지 못했어요. brew install mkcert 후 npm run certs를 다시 실행하세요.' : '인증서 생성에 실패했어요. 위 오류를 확인하고 npm run certs를 다시 실행하세요.')
    process.exitCode = 1
  }
}
