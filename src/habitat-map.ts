import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

export type Point = [number, number]
export type Place = { name:string; lat:number; lon:number }
export type Landmark = { name:string; kind:'station'|'sight'|'place'; point:Point }
export type District = {
  buildings:{ring:Point[]; height:number}[]
  paths:Point[][]
  water:Point[][]
  parks:Point[][]
  landmarks:Landmark[]
}
export const radius = 23
const meters = 260
const zoom = 14
const n = 2 ** zoom

async function request(url:string, signal:AbortSignal) {
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(18000)])})
  if(!response.ok) throw new Error('지도 서비스가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.')
  return response
}

export async function searchAddress(query:string, signal:AbortSignal):Promise<Place[]> {
  const url=new URL('https://photon.komoot.io/api/')
  url.search=new URLSearchParams({q:query,limit:'5'}).toString()
  const data=await (await request(url.href,signal)).json()
  return data.features.flatMap((item:{geometry:{coordinates:number[]};properties:Record<string,string>})=>{
    const [lon,lat]=item.geometry.coordinates,p=item.properties
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>85)return []
    const name=[...new Set([p.city,p.district,p.street,p.housenumber,p.name].filter(Boolean))].join(' ')
    return [{lat,lon,name:name||p.country||query}]
  })
}

export function inside([x,z]:Point,ring:Point[]) {
  let hit=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,az]=ring[i],[bx,bz]=ring[j]
    if((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax)hit=!hit
  }
  return hit
}

export async function loadDistrict(place:Place,signal:AbortSignal):Promise<District> {
  const cx=(place.lon+180)/360*n, radians=place.lat*Math.PI/180
  const cy=(1-Math.asinh(Math.tan(radians))/Math.PI)/2*n
  const span=meters/(40075016.7*Math.cos(radians)/n)
  const tiles=await (await request('https://tiles.openfreemap.org/planet',signal)).json()
  const jobs:Promise<void>[]=[]
  const district:District={buildings:[],paths:[],water:[],parks:[],landmarks:[]}
  const unique=new Set<string>()
  async function read(x:number,y:number){
    const url=tiles.tiles[0].replace('{z}',zoom).replace('{x}',(x+n)%n).replace('{y}',y)
    const buffer=await (await request(url,signal)).arrayBuffer()
    if(!buffer.byteLength)return
    const tile=new VectorTile(new PbfReader(new Uint8Array(buffer)))
    for(const layerName of ['building','transportation','water','park','poi']){
      const layer=tile.layers[layerName]
      if(!layer)continue
      for(let i=0;i<layer.length;i++){
        const feature=layer.feature(i),p=feature.properties,scale=radius/span
        const convert=(u:number,v:number):Point=>[(x-cx+u/feature.extent)*scale,(y-cy+v/feature.extent)*scale]
        const bounds=feature.bbox(),a=convert(bounds[0],bounds[1]),b=convert(bounds[2],bounds[3])
        if(a[0]>radius||a[1]>radius||b[0]<-radius||b[1]<-radius)continue
        const center:Point=[(a[0]+b[0])/2,(a[1]+b[1])/2]
        const key=[layerName,feature.id??'',...center.map(v=>v.toFixed(2))].join('/')
        if(unique.has(key))continue
        unique.add(key)
        const name=String(p['name:ko']||p.name||'')
        if(name && (layerName==='poi'||layerName==='park') && Math.hypot(...center)<radius-1){
          const type=[p.class,p.subclass].join(' ')
          const kind=/subway|railway.*station|train_station/.test(type)?'station':/attraction|museum|historic|monument|castle|gallery|theatre|park|tourism|town_hall/.test(type)?'sight':'place'
          district.landmarks.push({name,kind,point:center})
        }
        if(layerName==='poi')continue
        for(const line of feature.loadGeometry()){
          const ring=line.map(({x,y})=>convert(x,y))
          if(layerName==='building' && ring.length>3 && Math.hypot(...center)<radius-1 && ring.every(pt=>Math.hypot(...pt)<radius)){
            district.buildings.push({ring,height:Math.min(4.4,1.1+Math.max(0,Number(p.render_height)||0)*.065)})
          }else if(layerName==='transportation' && feature.type===2 && !/rail|ferry|aerialway/.test(String(p.class))){
            district.paths.push(ring)
          }else if(layerName==='water' && feature.type===3)district.water.push(ring)
          else if(layerName==='park' && feature.type===3)district.parks.push(ring)
        }
      }
    }
  }
  for(let x=Math.floor(cx-span);x<=Math.floor(cx+span);x++)
    for(let y=Math.floor(cy-span);y<=Math.floor(cy+span);y++)jobs.push(read(x,y))
  await Promise.all(jobs)
  if(!district.buildings.length && !district.paths.length && !district.landmarks.length && !district.parks.length)
    throw new Error('이 위치 주변에는 산책에 필요한 지도 정보가 부족해요. 가까운 역이나 도로명을 골라 주세요.')
  const priority={station:0,sight:1,place:2}
  district.landmarks.sort((a,b)=>priority[a.kind]-priority[b.kind]||Math.hypot(...a.point)-Math.hypot(...b.point))
  district.landmarks=district.landmarks.filter((p,i,all)=>all.findIndex(other=>other.name===p.name)===i).slice(0,10)
  return district
}
