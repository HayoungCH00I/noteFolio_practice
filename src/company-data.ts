export const companyStations = { boss: { x: -5, z: -3, title: '부장님과 면담', color: '#f5b9a5' }, printer: { x: 5, z: -3, title: '무한 복합기', color: '#a4dbe8' }, toilet: { x: -5, z: 3.5, title: '화캉스', color: '#c4bae8' }, desk: { x: 5, z: 3.5, title: '업무의 날씨', color: '#b8d5ab' } }
export type StationKey = keyof typeof companyStations
export type CompanyBoss = { anger: number; mood: 'angry' | 'dejected'; changedAt: number; cycles: number }
export type CompanyPlayer = { id: string; nickname: string; x: number; z: number; angle: number; shirt: number; skin: number; hair: number; outfit: number; station: StationKey | null; slot: number; tasks: number; pose: number; anger: number; actionAt: number; result: string }
