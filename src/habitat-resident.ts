import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import humanUrl from './assets/pose-wall-human.glb?url'
import gait from './assets/habitat-walk.json'

export async function loadWalker() {
  const {scene}=await new GLTFLoader().loadAsync(humanUrl)
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
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i),x=pos.getX(i),z=pos.getZ(i)
    // Reserve the upper atlas half for the head and wrap the lower half around the outfit.
    const head=y>=85, centerZ=head?2:0
    const u=.5+Math.atan2(x,z-centerZ)/(2*Math.PI)
    uv.push(u,head?.5+.5*T.MathUtils.clamp((y-85)/15,0,1):.5*Math.min(1,y/85))
  }
  mesh.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2))
  const atlas=document.createElement('canvas');atlas.width=atlas.height=512
  const ctx=atlas.getContext('2d')!
  const texture=new T.CanvasTexture(atlas);texture.colorSpace=T.SRGBColorSpace
  mesh.material=new T.MeshStandardMaterial({map:texture,roughness:.86})
  mesh.castShadow=true
  function skin(image?:CanvasImageSource){
    ctx.fillStyle='#e9ba98';ctx.fillRect(0,0,512,512)
    ctx.fillStyle='#563e38';ctx.fillRect(0,0,512,40)
    ctx.fillStyle='#527085';ctx.fillRect(0,256,512,256)
    ctx.fillStyle='#f0a573';ctx.fillRect(0,256,512,116)
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
        bones[base+2].quaternion.copy(limb===0?bones[base+1].quaternion:new T.Quaternion())
      }
    }
    scene.position.y=(rest[7].y-Math.min(bones[7].position.y,bones[13].position.y))*.024
  }
  pose(0,false)
  return {model,skin,pose}
}
