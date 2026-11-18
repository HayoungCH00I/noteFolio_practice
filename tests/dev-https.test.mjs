import { test } from 'node:test'
import assert from 'node:assert/strict'
import config from '../vite.config.mjs'
import { certificateHosts } from '../scripts/setup-dev-https.mjs'
import { resolveConfig, isFileLoadingAllowed } from 'vite'
import { resolve } from 'node:path'

test('certificate hosts include loopback and each LAN IPv4 once, excluding inactive and internal addresses', () => {
  assert.deepEqual(certificateHosts({ lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }], en0: [{ family: 'IPv4', address: '172.30.1.23', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }], en1: undefined, bridge: [{ family: 4, address: '172.30.1.23', internal: false }] }), ['localhost', '127.0.0.1', '::1', '172.30.1.23'])
})
test('build and preview require no private certificates and preserve the worker and multiplayer plugins', () => {
  for (const environment of [{ command: 'build' }, { command: 'serve', isPreview: true }]) {
    const value = config(environment)
    assert.equal(value.server.https, undefined); assert.equal(value.server.host, environment.isPreview ? undefined : '0.0.0.0'); assert.equal(value.server.port, 5173)
    assert.equal(value.worker.format, 'es'); assert.equal(value.plugins[0].name, 'company-local-multiplayer')
    assert.equal(typeof value.plugins[0].configureServer, 'function'); assert.equal(typeof value.plugins[0].configurePreviewServer, 'function')
    for (const denied of ['**/.certs/**', '*.{crt,pem,key,p12,pfx,cer,der}', '.env', '.env.*', '.npmrc', '.yarnrc.yml', '**/.git/**']) assert.ok(value.server.fs.deny.includes(denied))
  }
})
test('Vite refuses certificate-directory requests while continuing to serve application files', async () => {
  const resolved = await resolveConfig({ ...config({ command: 'build' }), configFile: false }, 'serve')
  for (const file of ['.certs/dev-key.pem', '.certs/dev-cert.pem', '.certs/rootCA.pem', '.certs/metadata.json']) assert.equal(isFileLoadingAllowed(resolved, resolve(file)), false)
  assert.equal(isFileLoadingAllowed(resolved, resolve('src/main.ts')), true)
})
