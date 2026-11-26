import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { inside, radius, type District, type Landmark, type Point } from './habitat-map.ts'

export const earthRadius=110
export const groundY=(x:number,z:number)=>Math.sqrt(earthRadius**2-x*x-z*z)-earthRadius+.76

export function buildTown(map:District){
  const root=new T.Group()
  const atlas=document.createElement('canvas');atlas.width=atlas.height=1024
  const ctx=atlas.getContext('2d')!,k=atlas.width/(radius*2)
  ctx.fillStyle='#9dc982';ctx.fillRect(0,0,1024,1024)
  ctx.translate(512,512);ctx.scale(k,k)
  let seed=3721
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<9500;i++){
    ctx.fillStyle=i%3?'#96c47e':'#b4d58e'
    ctx.fillRect(random()*radius*2-radius,random()*radius*2-radius,.08+random()*.12,.06)
  }
  function trace(line:Point[]){
    ctx.beginPath()
    line.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z))
  }
  for(const ring of map.parks){trace(ring);ctx.fillStyle='#86b871';ctx.fill()}
  ctx.lineJoin=ctx.lineCap='round'
  for(const [color,width] of [['#c3ad87',1.22],['#ebd5a7',1.05]] as const){
    ctx.strokeStyle=color;ctx.lineWidth=width
    for(const path of map.paths){trace(path);ctx.stroke()}
  }
  for(const ring of map.water){trace(ring);ctx.fillStyle='#83c6cb';ctx.fill();ctx.strokeStyle='#bfe0cc';ctx.lineWidth=.22;ctx.stroke()}
  const texture=new T.CanvasTexture(atlas);texture.colorSpace=T.SRGBColorSpace
  const ground=new T.RingGeometry(.0001,radius,112,24).rotateX(-Math.PI/2)
  const positions=ground.attributes.position,uv=ground.attributes.uv
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i)
    positions.setY(i,groundY(x,z));uv.setXY(i,.5+x/(radius*2),.5-z/(radius*2))
  }
  ground.computeVertexNormals()
  const terrain=new T.Mesh(ground,new T.MeshStandardMaterial({map:texture,roughness:1}))
  terrain.receiveShadow=true;root.add(terrain)
  const batches=new Map<string,T.BufferGeometry[]>()
  const transform=new T.Object3D()
  function part(shape:T.BufferGeometry,color:string,x:number,y:number,z:number,sx=1,sy=1,sz=1,turn=0){
    transform.position.set(x,y,z);transform.rotation.set(0,turn,0);transform.scale.set(sx,sy,sz);transform.updateMatrix()
    const geometry=shape.index?shape.toNonIndexed():shape.clone()
    geometry.deleteAttribute('uv');geometry.applyMatrix4(transform.matrix)
    if(!batches.has(color))batches.set(color,[])
    batches.get(color)!.push(geometry)
  }
  const cube=new T.BoxGeometry(),ball=new T.IcosahedronGeometry(1,1),trunk=new T.CylinderGeometry(.11,.15,1,8)
  const walls=['#ffdfad','#f0b89c','#d5dcb3','#f9d395'],roofs=['#bc705b','#789c91','#717e99','#cb9661']
  const blockers=map.buildings.slice().sort((a,b)=>Math.hypot(...a.ring[0])-Math.hypot(...b.ring[0])).slice(0,48)
  for(const [i,{ring,height}] of blockers.entries()){
    const bounds=new T.Box2().setFromPoints(ring.map(([x,z])=>new T.Vector2(x,z)))
    const mid=bounds.getCenter(new T.Vector2()),floor=groundY(mid.x,mid.y)-.14
    const shape=new T.Shape(ring.map(([x,z])=>new T.Vector2(x-mid.x,mid.y-z)))
    const shell=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}).rotateX(-Math.PI/2)
    const h=height+Math.min(1.1,(bounds.max.x-bounds.min.x)*.14)
    part(shell,walls[i%walls.length],mid.x,floor,mid.y,1,h,1)
    part(shell,roofs[i%roofs.length],mid.x,floor+h,mid.y,1.04,.25,1.04)
    shell.dispose()
    // Place window frames directly along the mapped facade edges.
    for(let j=1;j<ring.length;j++){
      const [ax,az]=ring[j-1],[bx,bz]=ring[j],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz)
      const count=Math.min(7,Math.floor(len/.95))
      for(let m=0;m<count;m++){
        const f=(m+.5)/count,x=ax+dx*f,z=az+dz*f,y=floor+h*.57,turn=-Math.atan2(dz,dx)
        part(cube,'#fff0cb',x,y,z,.43,.54,.10,turn)
        part(cube,'#729795',x,y,z,.31,.39,.12,turn)
      }
    }
  }
  const trees:Point[]=[]
  function free(x:number,z:number){
    if(Math.hypot(x,z)>radius-1 || trees.some(([a,b])=>Math.hypot(a-x,b-z)<.44))return false
    return !blockers.some(b=>inside([x,z],b.ring))&&!map.water.some(r=>inside([x,z],r))
  }
  function onRoad(x:number,z:number){
    return map.paths.some(path=>path.some(([bx,bz],i)=>{
      if(!i)return false
      const [ax,az]=path[i-1],dx=bx-ax,dz=bz-az
      const t=T.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1)
      return Math.hypot(x-ax-t*dx,z-az-t*dz)<.9
    }))
  }
  for(let i=0;i<105;i++){
    const x=(random()*2-1)*radius,z=(random()*2-1)*radius
    if(!free(x,z)||onRoad(x,z)||trees.some(([a,b])=>Math.hypot(x-a,z-b)<2))continue
    const y=groundY(x,z),s=.65+random()*.7
    trees.push([x,z])
    part(trunk,'#996e48',x,y+.65*s,z,s,1.3*s,s)
    part(ball,'#65976a',x,y+1.65*s,z,.96*s,1.06*s,.92*s)
    part(ball,'#91b86c',x-.34*s,y+1.97*s,z+.12*s,.72*s,.75*s,.72*s)
    for(let j=0;j<4;j++)part(ball,j%2?'#f3c778':'#f2a092',x+.7*Math.cos(j),y+.08,z+.7*Math.sin(j),.09,.1,.09)
  }
  const signs:Landmark[]=[]
  const spriteTextures:T.Texture[]=[]
  for(const poi of map.landmarks){
    const [x,z]=poi.point
    if(signs.some(other=>Math.hypot(x-other.point[0],z-other.point[1])<2.3)||signs.length>=7)continue
    signs.push(poi)
    const y=groundY(x,z),top=blockers.reduce((max,b)=>inside([x,z],b.ring)?Math.max(max,b.height+1.55):max,1.45)
    const color=poi.kind==='station'?'#427f86':poi.kind==='sight'?'#c87856':'#628563'
    if(poi.kind==='station'){
      part(cube,'#e9d7ab',x,y+.62,z,1.3,1.24,1.1)
      part(cube,color,x,y+1.32,z,1.62,.24,1.4)
      part(cube,'#40585b',x,y+.5,z+.56,.64,.91,.07)
    }
    const tag=document.createElement('canvas');tag.width=512;tag.height=96
    const ink=tag.getContext('2d')!
    ink.fillStyle=color;ink.beginPath();ink.roundRect(3,5,506,83,36);ink.fill()
    ink.fillStyle='#fffbea';ink.font='bold 39px sans-serif';ink.textAlign='center';ink.textBaseline='middle'
    ink.fillText((poi.kind==='station'?'Ⓜ ':'')+poi.name,256,47,475)
    const tex=new T.CanvasTexture(tag);tex.colorSpace=T.SRGBColorSpace;spriteTextures.push(tex)
    const sign=new T.Sprite(new T.SpriteMaterial({map:tex,depthWrite:false}))
    sign.scale.set(3.6,.73,1);sign.position.set(x,y+top+.5,z);root.add(sign)
  }
  for(const [color,geometries] of batches){
    const mesh=new T.Mesh(mergeGeometries(geometries),new T.MeshStandardMaterial({color,roughness:.87}))
    root.add(mesh);mesh.castShadow=mesh.receiveShadow=true;geometries.forEach(g=>g.dispose())
  }
  cube.dispose();ball.dispose();trunk.dispose()
  const canWalk=(x:number,z:number)=>free(x,z)&&free(x-.24,z)&&free(x+.24,z)&&free(x,z-.24)&&free(x,z+.24)
  let spawn:Point|undefined
  for(let r=0;r<radius-1&&!spawn;r+=.5){
    for(let i=0;i<48;i++){const a=i*Math.PI/24,x=r*Math.sin(a),z=r*Math.cos(a);if(canWalk(x,z)){spawn=[x,z];break}}
  }
  function dispose(){
    root.traverse(obj=>{if(obj instanceof T.Mesh){obj.geometry.dispose();obj.material.dispose()}else if(obj instanceof T.Sprite)obj.material.dispose()})
    texture.dispose();spriteTextures.forEach(t=>t.dispose())
  }
  if(!spawn){dispose();throw new Error('이 지역에서 걸을 공간을 찾지 못했어요. 가까운 길을 선택해 주세요.')}
  return {root,spawn,canWalk,signs,dispose}
}
