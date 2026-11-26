import * as T from 'three'
import { radius, type District, type Point } from './habitat-map.ts'
import { earthRadius, mapNormal, mapPoint, sceneryScale } from './habitat-sphere.ts'

import { seasons, type Season } from './habitat-seasons.ts'

// Clip tile geometry to the local map before projecting it onto the closed sphere.
function clipLine(a:Point,b:Point):[Point,Point]|undefined{
  const dx=b[0]-a[0], dz=b[1]-a[1]
  let lo=0,hi=1
  for(const [p,q] of [[-dx,a[0]+radius],[dx,radius-a[0]],[-dz,a[1]+radius],[dz,radius-a[1]]]){
    if(!p){if(q<0)return;continue}
    const t=q/p
    if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t)
    if(lo>hi)return
  }
  return [[a[0]+lo*dx,a[1]+lo*dz],[a[0]+hi*dx,a[1]+hi*dz]]
}

export function createTerrain(map:District){
  const root=new T.Group()
  const mask=document.createElement('canvas');mask.width=1024;mask.height=512
  const ctx=mask.getContext('2d',{willReadFrequently:true})!
  ctx.scale(mask.width/(2*radius),mask.height/(2*radius));ctx.translate(radius,radius)
  function trace(points:Point[]){
    ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z))
  }
  ctx.fillStyle='#000';ctx.fillRect(-radius,-radius,2*radius,2*radius)
  ctx.fillStyle='#00ff00'
  for(const p of map.parks){trace(p);ctx.fill()}
  ctx.filter='blur(1.5px)'
  ctx.fillStyle=ctx.strokeStyle='#ff0000';ctx.lineJoin=ctx.lineCap='round'
  for(const p of map.water){trace(p);ctx.fill()}
  ctx.lineWidth=.22*sceneryScale;for(const p of map.streams){trace(p);ctx.stroke()}
  const rgba=ctx.getImageData(0,0,mask.width,mask.height).data
  function channel(x:number,z:number,c:number){
    const u=T.MathUtils.euclideanModulo(Math.floor((x/radius+1)*.5*mask.width),mask.width)
    const v=T.MathUtils.clamp(Math.floor((z/radius+1)*.5*mask.height),0,mask.height-1)
    return rgba[(v*mask.width+u)*4+c]/255
  }
  function relief(x:number,z:number){
    return -.39*channel(x,z,0)
  }
  const cols=448,rows=224,positions:number[]=[],colors:number[]=[],indices:number[]=[]
  const grass=new T.Color('#abcf83'),meadow=new T.Color('#93c17a'),bank=new T.Color('#d1b487'),color=new T.Color(),n=new T.Vector3()
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=(i/cols*2-1)*radius,z=(j/rows*2-1)*radius
    const depth=relief(x,z),park=channel(x,z,1)
    mapNormal(x,z,n).multiplyScalar(earthRadius+depth)
    positions.push(n.x,n.y,n.z)
    color.copy(grass).lerp(meadow,park*.6+.16*(1+Math.sin(n.x*.8)*Math.cos(n.z*.6)))
    if(depth<-.02)color.lerp(bank,Math.min(1,-depth*5))
    colors.push(color.r,color.g,color.b)
    if(i<cols&&j<rows){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2)}
  }
  function indexed(vertices:number[],index:number[]){
    const geometry=new T.BufferGeometry()
    geometry.setIndex(index);geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals()
    return geometry
  }
  const ground=indexed(positions,indices)
  ground.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  const land=new T.Mesh(ground,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));land.receiveShadow=true;root.add(land)
  // A separate water shell meets the depressed river bed below the grass bank.
  const water=new T.Mesh(new T.SphereGeometry(earthRadius-.12,208,112),new T.MeshStandardMaterial({color:'#6bc9ce',roughness:.33,metalness:.09}))
  root.add(water)
  const paths:{a:T.Vector3;b:T.Vector3;bridge:boolean}[]=[]
  const bridgeKeys=new Set(map.bridges.map(p=>JSON.stringify(p)))
  const strips=new Map<string,{v:number[];f:number[]}>()
  function strip(key:string,a:T.Vector3,b:T.Vector3,width:number,h:number,offset=0){
    if(!strips.has(key))strips.set(key,{v:[],f:[]})
    const {v,f}=strips.get(key)!,start=v.length/3
    const side=new T.Vector3().crossVectors(a,b).normalize()
    for(const center of [a,b]){
      for(const s of [-1,1]){
        const pt=center.clone().multiplyScalar(earthRadius).addScaledVector(side,(offset+s*width)*sceneryScale).setLength(earthRadius+h*sceneryScale)
        v.push(pt.x,pt.y,pt.z)
      }
    }
    f.push(start,start+2,start+1,start+1,start+2,start+3)
  }
  for(const line of map.paths){
    const bridge=bridgeKeys.has(JSON.stringify(line))
    for(let i=1;i<line.length;i++){
      const ends=clipLine(line[i-1],line[i]);if(!ends)continue
      const [a,b]=ends
      const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.22))
      let from=mapNormal(...a)
      for(let j=1;j<=steps;j++){
        const t=j/steps,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t)
        const to=mapNormal(x,z)
        if(from.distanceToSquared(to)>1e-11 && (bridge||channel(x,z,0)<.5)){
          paths.push({a:from,b:to,bridge})
          if(bridge){
            strip('#b18a65',from,to,.32,.075)
            strip('#f1d4a1',from,to,.034,.22,-.30)
            strip('#f1d4a1',from,to,.034,.22,.30)
          }else{
            strip('#c8ac80',from,to,.28,.021)
            strip('#ecd09e',from,to,.235,.031)
          }
        }
        from=to
      }
    }
  }
  for(const [tint,{v,f}] of strips){
    const mesh=new T.Mesh(indexed(v,f),new T.MeshStandardMaterial({color:tint,roughness:.88,side:T.DoubleSide}))
    mesh.receiveShadow=true;root.add(mesh)
  }
  // Spatial bins keep traversal cost local even for dense street maps.
  const margin=.65*sceneryScale
  const bins=new Map<string,typeof paths>()
  const key=(x:number,y:number,z:number)=>[x,y,z].join('/')
  for(const path of paths){
    const a=path.a.clone().multiplyScalar(earthRadius),b=path.b.clone().multiplyScalar(earthRadius)
    for(let i=Math.floor((Math.min(a.x,b.x)-margin)/2);i<=Math.floor((Math.max(a.x,b.x)+margin)/2);i++)
      for(let j=Math.floor((Math.min(a.y,b.y)-margin)/2);j<=Math.floor((Math.max(a.y,b.y)+margin)/2);j++)
        for(let k=Math.floor((Math.min(a.z,b.z)-margin)/2);k<=Math.floor((Math.max(a.z,b.z)+margin)/2);k++){
          const id=key(i,j,k);if(!bins.has(id))bins.set(id,[]);bins.get(id)!.push(path)
        }
  }
  const ab=new T.Vector3(),ap=new T.Vector3()
  function nearRoad(normal:T.Vector3,width:number,bridgeOnly=false){
    const r=earthRadius/2
    return bins.get(key(Math.floor(normal.x*r),Math.floor(normal.y*r),Math.floor(normal.z*r)))?.some(({a,b,bridge})=>{
      if(bridgeOnly&&!bridge)return false
      ab.subVectors(b,a);ap.subVectors(normal,a)
      ap.addScaledVector(ab,-T.MathUtils.clamp(ap.dot(ab)/ab.lengthSq(),0,1))
      return ap.lengthSq()<(width*sceneryScale/earthRadius)**2
    })??false
  }
  function wet(normal:T.Vector3){const [x,z]=mapPoint(normal);return channel(x,z,0)>.45}
  function floor(normal:T.Vector3){
    if(nearRoad(normal,.32,true))return earthRadius+.076*sceneryScale
    if(nearRoad(normal,.28))return earthRadius+.032*sceneryScale
    return earthRadius+relief(...mapPoint(normal))
  }
  function setSeason(season:Season){
    const palette=seasons[season]
    land.material.vertexColors=season!=='winter'
    land.material.color.set(palette.ground);land.material.needsUpdate=true
    water.material.color.set(palette.water)
  }
  return {root,nearRoad,wet,floor,setSeason}
}
