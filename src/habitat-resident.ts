import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import humanUrl from './assets/pose-wall-human.glb?url'
import gait from './assets/habitat-walk.json'

export type Walker = ReturnType<Awaited<ReturnType<typeof loadWalkers>>>
export async function loadWalkers() {
  const template=await new GLTFLoader().loadAsync(humanUrl)
  return (variant:number) => createWalker(clone(template.scene),variant)
}
const styles=[
  ['#e9bb96','#43342e','#437e73','#405976','#ffe6a9'],
  ['#ce9574','#634733','#c86551','#37485d','#ffe3ba'],
  ['#f0c7a6','#302f38','#7080a9','#685850','#fff2dc'],
  ['#ba8669','#3e3332','#e5ac4e','#505c6e','#775947'],
  ['#edbc98','#81543e','#b27a9a','#435f5b','#f6dda8'],
]
function createWalker(scene:T.Object3D,variant:number) {
  const mesh=scene.children.find(child=>child instanceof T.SkinnedMesh) as T.SkinnedMesh<T.BufferGeometry,T.MeshStandardMaterial>
  const bones=mesh.skeleton.bones
  const rest=bones.map(bone=>bone.position.clone())
  // The pose guide stores its weighted bones as siblings in model coordinates.
  // Animate both segment origins and orientations so the skin stays joined at elbows and knees.
  const model=new T.Group()
  model.add(scene)
  scene.scale.setScalar(.024)
  mesh.frustumCulled=false
  const pos=mesh.geometry.getAttribute('position'),uv=[]
  if(!mesh.geometry.hasAttribute('uv')) {
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i),x=pos.getX(i),z=pos.getZ(i)
      // Reserve the upper atlas half for the head and wrap the lower half around the outfit.
      const head=y>=85, centerZ=head?2:0
      const u=.5+Math.atan2(x,z-centerZ)/(2*Math.PI)
      if(Math.abs(x)>17 && y<71){uv.push(.02,.92);continue}
      uv.push(u,head?.5+.5*T.MathUtils.clamp((y-85)/15,0,1):.5*Math.min(1,y/85))
    }
    mesh.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
  }
  const atlas=document.createElement('canvas');atlas.width=atlas.height=512
  const ctx=atlas.getContext('2d')!
  const texture=new T.CanvasTexture(atlas);texture.colorSpace=T.SRGBColorSpace
  mesh.material=new T.MeshStandardMaterial({map:texture,roughness:.86})
  mesh.castShadow=true
  function skin(image?:CanvasImageSource){
    const [tone,hair,shirt,trousers,trim]=styles[variant%styles.length]
    ctx.fillStyle=tone;ctx.fillRect(0,0,512,512)
    ctx.fillStyle=hair;ctx.fillRect(0,0,512,53)
    ctx.beginPath();ctx.moveTo(0,45);ctx.lineTo(512,45);ctx.lineTo(512,179);ctx.quadraticCurveTo(390,192,347,86);ctx.quadraticCurveTo(263,61,204,84);ctx.quadraticCurveTo(142,169,0,182);ctx.fill()
    ctx.fillStyle=tone;ctx.fillRect(2,33,17,17)
    ctx.fillStyle=trousers;ctx.fillRect(0,256,512,256)
    ctx.fillStyle=shirt;ctx.fillRect(0,256,512,116)
    ctx.fillStyle=trim
    for(let y=298;y<350;y+=variant%2?18:25)ctx.fillRect(0,y,512,variant%2?4:8)
    ctx.fillRect(0,360,512,6)
    ctx.fillStyle=tone;ctx.fillRect(0,256,512,12)
    ctx.fillStyle='#5a433e';ctx.fillRect(0,485,512,27)
    if(image){
      ctx.save();ctx.beginPath();ctx.ellipse(256,134,84,112,0,0,Math.PI*2);ctx.clip()
      ctx.drawImage(image,172,22,168,224);ctx.restore()
      ctx.save();ctx.globalAlpha=.68;ctx.drawImage(image,125,258,262,111);ctx.restore()
    }else{
      ctx.fillStyle='#382f31'
      for(const x of [233,279]){ctx.beginPath();ctx.ellipse(x,122,5,8,0,0,Math.PI*2);ctx.fill()}
      ctx.strokeStyle='#9c6554';ctx.lineWidth=4;ctx.beginPath();ctx.arc(256,151,13,.22,Math.PI-.22);ctx.stroke()
    }
    texture.needsUpdate=true
  }
  const accessories=new T.Group()
  bones[1].add(accessories)
  const fabric=new T.MeshStandardMaterial({roughness:.9})
  function piece(shape:T.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number){
    const m=new T.Mesh(shape,fabric)
    m.position.set(x,y,z);m.scale.set(sx,sy,sz);accessories.add(m)
  }
  function styleAccessory(){
    for(const child of [...accessories.children]){
      (child as T.Mesh).geometry.dispose();accessories.remove(child)
    }
    const style=variant%styles.length
    fabric.color.set(styles[style][style===3?1:2])
    if(style===1 || style===4){
      piece(new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.52),0,3.7,-.5,5.3,3.5,5.6)
      if(style===1)piece(new T.SphereGeometry(1,16,8),0,3.6,4.3,4.4,.4,3)
      else piece(new T.SphereGeometry(1,12,8),0,7.3,-.5,1.45,1.45,1.45)
    }else if(style===2){
      for(const x of [-2.2,2.2])piece(new T.TorusGeometry(1.6,.26,8,18),x,.4,4.8,1,.84,1)
      piece(new T.BoxGeometry(1,1,1),0,.6,4.8,1.4,.4,.4)
    }else if(style===3){
      piece(new T.SphereGeometry(1,16,10),0,2.4,-5.4,3.6,3.2,3.4)
    }
  }
  styleAccessory()
  skin()
  const dir=new T.Vector3(),bindDir=new T.Vector3()
  let clock=0
  function pose(dt:number,moving:boolean){
    clock=moving?clock+dt:0
    const frame=(clock/gait.duration%1)*gait.frames.length,idx=Math.floor(frame),alpha=frame-idx
    const current=gait.frames[idx],next=gait.frames[(idx+1)%gait.frames.length]
    const bob=moving?1.15*Math.sin(frame*Math.PI*4/gait.frames.length)**2:0
    bones[0].position.y=rest[0].y+bob
    bones[1].position.y=rest[1].y+bob
    for(let side=0;side<2;side++){
      const sign=side?1:-1
      for(let limb=0;limb<2;limb++){
        const base=2+side*6+limb*3
        bones[base].position.copy(rest[base]);bones[base].position.y+=bob
        for(let link=0;link<2;link++){
          const index=side*4+limb*2+link
          const angle=moving?(current[index]+(next[index]-current[index])*alpha)*.87:0
          dir.set(sign*(limb===0?.105:.02),-Math.cos(angle),Math.sin(angle)).normalize()
          bindDir.subVectors(rest[base+link+1],rest[base+link])
          const length=bindDir.length()
          bones[base+link].quaternion.setFromUnitVectors(bindDir.normalize(),dir)
          bones[base+link+1].position.copy(bones[base+link].position).addScaledVector(dir,length)
        }
        if(limb===0)bones[base+2].quaternion.copy(bones[base+1].quaternion)
        else bones[base+2].quaternion.identity()
      }
    }
    scene.position.y=(rest[7].y-Math.min(bones[7].position.y,bones[13].position.y))*.024
  }
  pose(0,false)
  function copySkin(other:{atlas:HTMLCanvasElement}){
    ctx.clearRect(0,0,512,512);ctx.drawImage(other.atlas,0,0);texture.needsUpdate=true
  }
  return {model,skin,pose,atlas,copySkin,setVariant(value:number){variant=value;styleAccessory();skin()}}
}
