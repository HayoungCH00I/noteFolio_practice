import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientInstallers } from '../scripts/package-https-clients.mjs'

test('recipient installers pin the public certificate, quote its path, import trust and open the HTTPS address', () => {
  const hash = 'a'.repeat(64), files = clientInstallers(hash, 'https://172.30.1.23:5173/')
  const mac = files['Mac-HTTPS-Setup.command'], windows = files['Windows-HTTPS-Setup.cmd']
  assert.ok(mac.includes(hash) && windows.includes(hash))
  assert.match(mac, /quoted form of certificatePath with administrator privileges/)
  assert.match(windows, /certutil\.exe -user -addstore Root \$cert/)
  assert.match(mac, /open "https:\/\/172\.30\.1\.23:5173\/"/)
  assert.match(windows, /start "" "https:\/\/172\.30\.1\.23:5173\/"/)
  assert.doesNotMatch(mac + windows, /PRIVATE KEY|ExecutionPolicy|WindowStyle|mkcert -install|npm run dev/)
  assert.ok(!windows.replaceAll('\r\n', '').includes('\n'))
})
test('installer generation rejects addresses and values that could inject commands or open an unrelated origin', () => {
  for (const url of ['http://172.30.1.23:5173/', 'https://example.com/', 'https://user:pass@172.30.1.23/', 'https://172.30.1.23/?command=anything', 'https://172.30.1.23/a', 'https://172.30.1.23/#fragment']) assert.throws(() => clientInstallers('a'.repeat(64), url))
  assert.throws(() => clientInstallers("hash';command", 'https://172.30.1.23/'))
})
