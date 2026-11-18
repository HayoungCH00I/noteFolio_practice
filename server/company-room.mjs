import { randomUUID } from 'node:crypto'
export const stations = { boss: { x: -5, z: -3 }, printer: { x: 5, z: -3 }, toilet: { x: -5, z: 3.5 }, desk: { x: 5, z: 3.5 } }
export class CompanyRoom {
  players = new Map()
  boss = { anger: 0, mood: 'angry', changedAt: 0, cycles: 0 }
  join(nickname) {
    const name = typeof nickname === 'string' ? nickname.trim().replace(/[\u0000-\u001f<>]/g, '').slice(0, 12) : ''
    if (!name) throw new Error('닉네임을 입력해 주세요.')
    if (this.players.size >= 24) throw new Error('회사가 가득 찼어요. 잠시 후 다시 입장해 주세요.')
    const outfits = Array.from({ length: 24 }, (_, i) => i).filter(i => ![...this.players.values()].some(p => p.shirt === i % 8 && p.outfit === Math.floor(i / 8)))
    const outfit = outfits[Math.floor(Math.random() * outfits.length)]
    const id = randomUUID()
    const player = { id, nickname: name, x: (Math.random() - .5) * 2, z: 0, angle: 0, shirt: outfit % 8, skin: Math.floor(Math.random() * 4), hair: Math.floor(Math.random() * 4), outfit: Math.floor(outfit / 8), station: null, slot: -1, tasks: 4, pose: 0, anger: 0, actionAt: 0, result: '', input: { x: 0, z: 0 }, lastInput: 0 }
    this.players.set(id, player); return player
  }
  remove(id) { this.players.delete(id) }
  command(id, message, now = Date.now()) {
    const p = this.players.get(id); if (!p || !message || typeof message !== 'object') return
    if (message.type === 'move') {
      if (!Number.isFinite(message.x) || !Number.isFinite(message.z)) return
      p.input = { x: Math.max(-1, Math.min(1, message.x)), z: Math.max(-1, Math.min(1, message.z)) }; p.lastInput = now
    } else if (message.type === 'use' && !p.station) {
      const entry = Object.entries(stations).find(([key, s]) => (!message.station || message.station === key) && Math.hypot(p.x - s.x, p.z - s.z) < 3)
      if (!entry) return
      const [key, s] = entry
      const slots = new Set([...this.players.values()].filter(other => other.station === key).map(other => other.slot))
      const slot = [0, 1, 2, 3].find(value => !slots.has(value)); if (slot === undefined) return
      p.station = key; p.slot = slot; p.x = s.x + (slot - 1.5) * 1.15; p.z = s.z + .9; p.angle = key === 'toilet' ? 0 : Math.PI; p.tasks = 4; p.anger = key === 'boss' ? this.boss.anger : 0; p.pose = 0; p.input = { x: 0, z: 0 }
    } else if (message.type === 'leave') {
      p.station = null; p.slot = -1; p.z = Math.min(6, p.z + 1.1); p.input = { x: 0, z: 0 }
    } else if (message.type === 'action' && p.station && now - p.actionAt > 180) {
      p.actionAt = now
      if (p.station === 'boss') {
        const hit = Math.sin(now / 550) > .65
        if (!hit) p.result = '조금만 더 기다렸다가!'
        else if (this.boss.mood === 'dejected' && now - this.boss.changedAt < 1400) p.result = '하… 잠깐만 내버려 둬요…'
        else if (this.boss.anger >= 5) {
          this.boss.anger = 0; this.boss.mood = 'dejected'; this.boss.changedAt = now; this.boss.cycles++
          p.result = '부장님이 포기했어요… 말해 봐야 안 듣네…'
        } else {
          this.boss.anger++; this.boss.mood = 'angry'; this.boss.changedAt = now
          p.result = `정확해요! 부장님 분노 ${this.boss.anger}/5`
        }
        for (const other of this.players.values()) if (other.station === 'boss') other.anger = this.boss.anger
      }
      else if (p.station === 'printer') { p.pose = (p.pose + 1) % 4; p.result = '내 얼굴 출력 완료!' }
      else if (p.station === 'toilet') p.result = '아하하! 여기가 진짜 휴양지 ♪'
      else { p.tasks = Math.max(0, p.tasks - 1); p.result = p.tasks ? '업무 하나 끝! 조금씩 맑아져요.' : '오늘 할 일 끝! 내 머리 위는 맑음 ☀' }
    }
  }
  step(dt, now = Date.now()) {
    for (const p of this.players.values()) {
      if (p.station || now - p.lastInput > 600) continue
      const length = Math.hypot(p.input.x, p.input.z), factor = 3.6 * Math.min(.1, dt) / Math.max(1, length)
      p.x = Math.max(-8.3, Math.min(8.3, p.x + p.input.x * factor)); p.z = Math.max(-6.3, Math.min(6.3, p.z + p.input.z * factor))
      if (length > .05) p.angle = Math.atan2(p.input.x, p.input.z)
    }
  }
  snapshot(now = Date.now()) { return { type: 'state', now, boss: { ...this.boss }, players: [...this.players.values()].map(({ input, lastInput, ...p }) => p) } }
}
