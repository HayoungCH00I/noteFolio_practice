import http from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import { attachCompanySocket } from './company-socket.mjs'
const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
if (!existsSync(path.join(dist, 'index.html'))) throw new Error('먼저 npm run build를 실행해 주세요.')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' }
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return }
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = path.resolve(dist, '.' + (requested === '/' ? '/index.html' : requested))
    if (!file.startsWith(dist + path.sep) && file !== path.join(dist, 'index.html')) { res.writeHead(403).end(); return }
    const info = await stat(file); if (!info.isFile()) throw new Error('not a file')
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' })
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res)
  } catch { res.writeHead(404).end('Not found') }
})
const company = attachCompanySocket(server)
const port = Number(process.env.COMPANY_PORT || 4173)
server.listen(port, '0.0.0.0', () => {
  console.log(`회사: http://localhost:${port}/#eighth`)
  for (const addresses of Object.values(networkInterfaces())) for (const item of addresses ?? []) if (item.family === 'IPv4' && !item.internal) console.log(`같은 네트워크에서: http://${item.address}:${port}/#eighth`)
})
server.on('error', error => { console.error(error.message); company.close(); process.exitCode = 1 })
process.on('SIGINT', () => { company.close(); server.close() })
