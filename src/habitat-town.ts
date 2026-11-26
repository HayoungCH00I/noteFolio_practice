import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { districtMeters, inside, type District, type Point } from './habitat-map.ts'
import { earthRadius, initialForward, mapNormal, miniatureScale, orient, sceneryScale } from './habitat-sphere.ts'
import { createTerrain } from './habitat-terrain.ts'

import { seasons, type Season } from './habitat-seasons.ts'

export function buildTown(map:District){
  const terrain=createTerrain(map),root=terrain.root
  const batches=new Map<string,T.BufferGeometry[]>(),textures:T.Texture[]=[]
  const anchor=new T.Object3D(),part=new T.Object3D(),matrix=new T.Matrix4()
  const cube=new T.BoxGeometry(),rounded=new RoundedBoxGeometry(1,1,1,2,.12)
  const ball=new T.SphereGeometry(1,12,9),pole=new T.CylinderGeometry(1,1,1,10)
  const hip=new T.CylinderGeometry(.16,1,1,4).rotateY(Math.PI/4)
  const repeated=new Set<T.BufferGeometry>([cube,rounded,ball,pole,hip])
  const instances=new Map<string,{shape:T.BufferGeometry;color:string;matrices:T.Matrix4[]}>()
  let seed=3721
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  function base(n:T.Vector3,scale=miniatureScale){
    anchor.position.copy(n).multiplyScalar(earthRadius-.018)
    orient(n,initialForward(n,0),anchor.quaternion)
    anchor.scale.setScalar(scale);anchor.updateMatrix()
  }
  function add(shape:T.BufferGeometry,color:string,x:number,y:number,z:number,sx=1,sy=1,sz=1,turn=0){
    part.position.set(x,y,z);part.rotation.set(0,turn,0);part.scale.set(sx,sy,sz);part.updateMatrix()
    matrix.multiplyMatrices(anchor.matrix,part.matrix)
    if(repeated.has(shape)){
      const key=shape.uuid+color
      if(!instances.has(key))instances.set(key,{shape,color,matrices:[]})
      instances.get(key)!.matrices.push(matrix.clone())
      return
    }
    const g=shape.index?shape.toNonIndexed():shape.clone()
    g.deleteAttribute('uv');g.applyMatrix4(matrix)
    if(!batches.has(color))batches.set(color,[])
    batches.get(color)!.push(g)
  }
  type Obstacle={n:T.Vector3;east:T.Vector3;south:T.Vector3;reach:number;height:number;ring?:Point[]}
  const obstacles:Obstacle[]=[]
  function block(n:T.Vector3,reach:number,height:number,ring?:Point[]){
    const south=initialForward(n,0)
    obstacles.push({n:n.clone(),east:new T.Vector3().crossVectors(n,south),south,reach,height,ring})
  }
  function occupied(n:T.Vector3,pad=.09){
    return obstacles.some(o=>{
      if(n.distanceToSquared(o.n)*earthRadius**2>(o.reach+pad)**2)return false
      if(!o.ring)return true
      const x=n.dot(o.east)*earthRadius,z=n.dot(o.south)*earthRadius
      return inside([x,z],o.ring)||inside([x+pad,z],o.ring)||inside([x-pad,z],o.ring)||inside([x,z+pad],o.ring)||inside([x,z-pad],o.ring)
    })
  }
  const walls=['#fff0d4','#ecbcb0','#d2e1c1','#fbddaa'],roofs=['#c9715c','#719794','#748ea4','#cc965b']
  const buildings=map.buildings
  const stride=Math.max(1,buildings.length/48)
  for(let k=0;k<buildings.length;k+=stride){
    const i=Math.floor(k),{ring,height}=buildings[i]
    const bounds=new T.Box2().setFromPoints(ring.map(([x,z])=>new T.Vector2(x,z))),mid=bounds.getCenter(new T.Vector2())
    const local:Point[]=ring.map(([x,z])=>[(x-mid.x)*districtMeters/260,(z-mid.y)*districtMeters/260])
    const normal=mapNormal(mid.x,mid.y)
    if(terrain.wet(normal)||terrain.nearRoad(normal,.25)||occupied(normal,1))continue
    base(normal)
    const shape=new T.Shape(local.map(([x,z])=>new T.Vector2(x,-z)))
    const shell=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false}).rotateX(-Math.PI/2)
    const w=(bounds.max.x-bounds.min.x)*districtMeters/260,d=(bounds.max.y-bounds.min.y)*districtMeters/260
    const h=height+Math.min(.8,w*.12)
    add(shell,'#d5c4a2',0,-.13,0,1,.28,1)
    add(shell,walls[i%4],0,.12,0,1,h,1)
    add(shell,roofs[i%4],0,h+.10,0,1.04,.22,1.04)
    shell.dispose()
    if(w>.8 && d>.8 && inside([0,0],local)){
      if(local.length<=7 && w<4.5 && d<4.5){
        add(hip,roofs[i%4],0,h+.58,0,w*.73,.8,d*.73)
        add(cube,'#b68062',w*.20,h+.66,-d*.15,.25,.65,.25)
      }else{
        add(rounded,'#e5d3b4',0,h+.45,0,Math.min(1.2,w*.4),.31,Math.min(.8,d*.4))
      }
    }
    let door=false
    for(let j=1;j<local.length;j++){
      const [x,z]=local[j-1],[bx,bz]=local[j],dx=bx-x,dz=bz-z,len=Math.hypot(dx,dz),turn=-Math.atan2(dz,dx)
      const count=Math.min(6,Math.floor(len/.9))
      for(let m=0;m<count;m++){
        const t=(m+.5)/count,px=x+dx*t,pz=z+dz*t
        if(!door && len>1.1){
          add(rounded,'#977457',px,.49,pz,.48,.8,.16,turn)
          add(cube,roofs[i%4],px,1.02,pz,.85,.12,.55,turn)
          door=true;continue
        }
        add(cube,'#fff4d5',px,h*.57+.1,pz,.46,.51,.075,turn)
        add(cube,'#83a8aa',px,h*.57+.1,pz,.32,.37,.092,turn)
      }
    }
    block(normal,Math.hypot(w,d)*miniatureScale/2,(h+1)*miniatureScale,local.map(([x,z])=>[x*miniatureScale,z*miniatureScale]))
  }
  const signs:District['landmarks']=[]
  for(const poi of map.landmarks){
    const n=mapNormal(...poi.point)
    if(signs.some(s=>n.distanceToSquared(mapNormal(...s.point))<.004)||signs.length>=8)continue
    signs.push(poi);base(n)
    const tint=poi.kind==='station'?'#487d8b':poi.kind==='sight'?'#be7058':'#60876b'
    let top=1.5
    if(poi.kind==='station'){
      add(rounded,'#e7d9b6',0,.40,0,1.9,.8,1.3)
      for(const x of [-.8,.8])add(pole,'#749591',x,1.1,0,.07,1.65,.07)
      add(rounded,tint,0,1.92,0,2.15,.22,1.55);top=2.1
      for(let j=0;j<4;j++)add(cube,'#a3b2a6',0,.1+j*.1,1-j*.18,1.3,.18,.24)
      block(n,.48*sceneryScale,sceneryScale)
    }else if(poi.kind==='sight'){
      // A small lookout pavilion marks a mapped attraction.
      add(rounded,'#cab995',0,.12,0,1.9,.26,1.7)
      for(const x of [-.68,.68])for(const z of [-.55,.55])add(pole,'#aa7459',x,.83,z,.09,1.45,.09)
      add(hip,'#648985',0,1.86,0,1.5,.83,1.35);top=2.35
      block(n,.42*sceneryScale,1.05*sceneryScale)
    }else add(pole,'#a68462',0,.6,0,.065,1.2,.065)
    const texCanvas=document.createElement('canvas');texCanvas.width=384;texCanvas.height=64
    const ctx=texCanvas.getContext('2d')!
    ctx.fillStyle=tint;ctx.beginPath();ctx.roundRect(0,0,384,64,20);ctx.fill()
    ctx.fillStyle='#fff9e5';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText((poi.kind==='station'?'Ⓜ ':'')+poi.name,192,32,358)
    const texture=new T.CanvasTexture(texCanvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture)
    const label=new T.Mesh(new T.PlaneGeometry(1.85,.32),new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide}))
    label.scale.setScalar(2);label.position.copy(n).multiplyScalar(earthRadius+top*miniatureScale+.44);label.quaternion.copy(anchor.quaternion);root.add(label)
  }
  const start:Point[]=[]
  for(let i=0;i<65;i++){
    // Equal-area placement gives the back and both poles the same vegetation density as the front.
    const z=1-2*(i+.5)/65,a=i*2.399963,r=Math.sqrt(1-z*z)
    const n=new T.Vector3(r*Math.cos(a),r*Math.sin(a),z)
    if(terrain.wet(n)||terrain.nearRoad(n,.62)||occupied(n,.55))continue
    const s=(.38+random()*.24)*sceneryScale;base(n,s)
    add(pole,'#a37850',0,.74,0,.18,1.55,.19)
    const leaf=i%3?'#7dad70':'#68a17a'
    add(ball,leaf,0,1.65,0,.92,1.02,.89)
    add(ball,'#a0c77c',-.34,2.04,.14,.68,.76,.66)
    add(ball,leaf,.48,1.82,-.1,.58,.7,.62)
    if(i%4===0)for(const [x,y,z] of [[.5,1.58,.65],[-.5,1.91,.5],[-.6,1.44,-.49]])add(ball,'#e99770',x,y,z,.17,.19,.17)
    if(i%3===0)for(let j=0;j<4;j++)add(ball,j%2?'#f4d482':'#f0aaa5',.76*Math.cos(j),.08,.76*Math.sin(j),.13,.12,.13)
    block(n,.18*s,2.8*s)
  }
  const blade=new T.ConeGeometry(1,1,3)
  repeated.add(blade)
  for(let i=0;i<420;i++){
    const z=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-z*z)
    const n=new T.Vector3(r*Math.cos(a),r*Math.sin(a),z)
    if(terrain.wet(n)||terrain.nearRoad(n,.38)||occupied(n))continue
    base(n)
    const green=i%2?'#a0bf73':'#bed78e'
    for(let j=0;j<3;j++)add(blade,green,j*.10,.05,j%2*.11,.09,.16,.09,j*.6)
    if(i%9===0){
      add(pole,'#73a66d',0,.14,0,.025,.26,.025)
      for(let j=0;j<5;j++)add(ball,i%2?'#fff1ca':'#e7ada5',.085*Math.cos(j*1.257),.29,.085*Math.sin(j*1.257),.072,.045,.072)
      add(ball,'#eec161',0,.31,0,.065,.04,.065)
    }
  }
  function canWalk(n:T.Vector3){return (!terrain.wet(n)||terrain.nearRoad(n,.29,true))&&!occupied(n)}
  // Start near the address, leaving room to move in several directions.
  for(let z=-8;z<=8;z+=1.2)for(let x=-8;x<=8;x+=1.2)if(canWalk(mapNormal(x,z)))start.push([x,z])
  start.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b))
  const homes:Point[]=[]
  for(const pt of start)if(homes.every(h=>Math.hypot(pt[0]-h[0],pt[1]-h[1])>2.4)&&Math.hypot(pt[0]-start[0][0],pt[1]-start[0][1])>1.2 && homes.length<4)homes.push(pt)
  for(const [color,geometries] of batches){
    const mesh=new T.Mesh(mergeGeometries(geometries),new T.MeshStandardMaterial({color,roughness:.9}))
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose())
  }
  const foliage=new Map<string,T.MeshStandardMaterial>()
  for(const {shape,color,matrices} of instances.values()){
    const mesh=new T.InstancedMesh(shape,new T.MeshStandardMaterial({color,roughness:.91}),matrices.length)
    foliage.set(color,mesh.material)
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m))
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh)
  }
  function dispose(){
    root.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();else o.geometry.dispose();o.material.dispose()}})
    repeated.forEach(g=>g.dispose());textures.forEach(t=>t.dispose())
  }
  if(!start.length){dispose();throw new Error('주소 주변에 걸을 땅이 부족해요. 가까운 도로나 역을 선택해 주세요.')}
  const probe=new T.Vector3(),wanted=new T.Vector3()
  function clearCamera(target:T.Vector3,eye:T.Vector3){
    wanted.copy(eye)
    for(let i=1;i<=20;i++){
      const t=i/20
      probe.lerpVectors(target,wanted,t)
      const altitude=probe.length()-earthRadius;probe.normalize()
      const hit=obstacles.some(o=>{
        if(altitude>o.height+.14 || probe.distanceToSquared(o.n)>((o.reach+.08)/earthRadius)**2)return false
        return !o.ring||inside([probe.dot(o.east)*earthRadius,probe.dot(o.south)*earthRadius],o.ring)
      })
      if(hit){
        eye.lerpVectors(target,wanted,Math.max(.23,t-.07))
        return
      }
    }
  }
  function setSeason(season:Season){
    terrain.setSeason(season)
    const p=seasons[season]
    const colors=[...p.leaves,...p.grass,p.flower]
    const summerColors=['#7dad70','#68a17a','#a0c77c','#a0bf73','#bed78e','#e7ada5']
    summerColors.forEach((base,i)=>foliage.get(base)?.color.set(colors[i]))
  }
  return {root,setSeason,spawn:start[0],homes,signs,canWalk,floor:terrain.floor,clearCamera,dispose}
}
