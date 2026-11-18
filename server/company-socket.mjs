import { WebSocketServer, WebSocket } from 'ws'
import { CompanyRoom } from './company-room.mjs'

export function attachCompanySocket(server) {
const room = new CompanyRoom()
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 })
wss.on('connection', socket => {
  let id, messages = 0, windowStart = Date.now()
  socket.alive = true; socket.on('pong', () => { socket.alive = true })
  socket.on('message', raw => {
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); messages = 0 }
    if (++messages > 80) return
    try {
      const message = JSON.parse(raw.toString())
      if (message.type === 'join' && !id) { const player = room.join(message.nickname); id = player.id; socket.send(JSON.stringify({ type: 'welcome', id })); socket.send(JSON.stringify(room.snapshot())) }
      else if (id) room.command(id, message)
    } catch (error) { socket.send(JSON.stringify({ type: 'error', message: error.message === '회사가 가득 찼어요. 잠시 후 다시 입장해 주세요.' ? error.message : '입장 정보를 확인해 주세요.' })) }
  })
  socket.on('close', () => room.remove(id)); socket.on('error', () => room.remove(id))
})
const loop = setInterval(() => { room.step(1 / 20); const message = JSON.stringify(room.snapshot()); for (const socket of wss.clients) if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 128000) socket.send(message) }, 50)
const heartbeat = setInterval(() => { for (const socket of wss.clients) { if (!socket.alive) { socket.terminate(); continue }; socket.alive = false; socket.ping() } }, 15000)

  const upgrade = (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/company') return
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
  }
  server.on('upgrade', upgrade)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(loop); clearInterval(heartbeat)
    server.off('upgrade', upgrade)
    for (const socket of wss.clients) socket.terminate()
    wss.close()
  }
  server.once('close', close)
  return { close }
}
