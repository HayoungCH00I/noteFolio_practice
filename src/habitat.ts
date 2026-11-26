import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import land from './assets/habitat-land.json'
import { loadWalker } from './habitat-resident.ts'
import { setupMoveIn } from './habitat-setup.ts'
import { buildTown, earthRadius, groundY } from './habitat-town.ts'
import type { Place, District } from './habitat-map.ts'

export async function createHabitat(root:HTMLElement){
  const walker=await loadWalker()
  const get=<E extends HTMLElement>(s:string)=>root.querySelector<E>(s)!
  const canvas=get<HTMLCanvasElement>('.habitat-world'),scene=new T.Scene()
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
  const camera=new T.PerspectiveCamera(37,1,.12,2000)
  const controls=new OrbitControls(camera,canvas)
  controls.enablePan=false;controls.enableDamping=true
  controls.minDistance=earthRadius*1.5;controls.maxDistance=earthRadius*7
  const planet=new T.Group();scene.add(planet);planet.position.y=-earthRadius
  const ocean=new T.Mesh(new T.SphereGeometry(earthRadius,120,80),new T.MeshStandardMaterial({color:'#385f75',roughness:.82}))
  planet.add(ocean)
  const dots=new T.InstancedMesh(new T.CircleGeometry(earthRadius*.018,6),new T.MeshStandardMaterial({color:'#c1e9a9'}),land.length)
  const marker=new T.Object3D(),forward=new T.Vector3(0,0,1)
  for(const [i,[longitude,latitude]] of land.entries()){
    const lon=T.MathUtils.degToRad(longitude),lat=T.MathUtils.degToRad(latitude)
    marker.position.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon))
    marker.quaternion.setFromUnitVectors(forward,marker.position)
    marker.position.multiplyScalar(earthRadius*1.004);marker.updateMatrix();dots.setMatrixAt(i,marker.matrix)
  }
  planet.add(dots)
  scene.add(new T.HemisphereLight(0xfff8dc,0xb6c5aa,1.75))
  const sun=new T.DirectionalLight(0xffefd2,2.1);sun.position.set(-28,48,30);sun.castShadow=true
  Object.assign(sun.shadow.camera,{left:-33,right:33,top:33,bottom:-33,near:1,far:110})
  sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.001;sun.shadow.normalBias=.035
  scene.add(sun)
  const starCoords=[]
  for(let i=0;i<600;i++){
    const y=1-2*(i+.5)/600,r=Math.sqrt(1-y*y),a=i*2.399963
    starCoords.push(950*r*Math.cos(a),950*y,950*r*Math.sin(a))
  }
  const starsGeometry=new T.BufferGeometry()
  starsGeometry.setAttribute('position',new T.Float32BufferAttribute(starCoords,3))
  const stars=new T.Points(starsGeometry,new T.PointsMaterial({color:0xcce4dc,size:1.3}))
  scene.add(stars)
  type Mode='globe'|'landing'|'auto'|'manual'|'chat'
  let mode:Mode='globe',town:ReturnType<typeof buildTown>|undefined,location:Place|undefined
  let active=false,frame=0,last=0,landing=0,heading=0,front=false,selected=false,wanderTime=0,chatIndex=0
  const held=new Set<string>(),actions=get('[data-actions]'),toolbar=get('[data-toolbar]'),pad=get('[data-pad]'),chat=get('[data-chat]')
  const scope=get('[data-location]'),view=get('[data-view]'),select=get('[data-select]')
  const cameraGoal=new T.Vector3(),look=new T.Vector3(),worldPos=new T.Vector3(),lookAt=new T.Vector3()
  const startCam=new T.Vector3(),startLook=new T.Vector3(),fromQ=new T.Quaternion(),toQ=new T.Quaternion()
  function resize(){
    if(!canvas.clientWidth||!canvas.clientHeight)return
    camera.aspect=canvas.clientWidth/canvas.clientHeight
    camera.zoom=mode==='globe'?Math.min(1,camera.aspect*.95):1
    camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false)
  }
  function ui(){
    const local=mode!=='globe'
    root.classList.toggle('habitat-town',local)
    get('footer').hidden=local;get('.habitat-credit').hidden=!local
    toolbar.hidden=!local||mode==='landing'||mode==='chat'
    pad.hidden=mode!=='manual';view.hidden=pad.hidden;get('[data-auto]').hidden=pad.hidden
    view.textContent=front?'뒷모습 보기':'앞모습 보기'
    select.hidden=mode!=='auto'||selected;actions.hidden=mode!=='auto'||!selected
    chat.hidden=mode!=='chat'
    scope.textContent=local?(location?.name??'')+(mode==='manual'?' · ↑↓ 걷기 · ←→ 돌기':mode==='auto'?' · 주민을 눌러 보세요':''):'드래그로 지구를 돌리고, 휠이나 두 손가락으로 확대해 보세요.'
  }
  function reset(){
    mode='globe';selected=false;held.clear();walker.model.removeFromParent()
    if(town){scene.remove(town.root);town.dispose();town=undefined}
    location=undefined;scene.fog=null;stars.visible=true
    planet.rotation.set(0,.7,0)
    controls.enabled=true;controls.target.copy(planet.position)
    camera.position.set(320,155,260).add(planet.position);camera.up.set(0,1,0)
    controls.update();resize();ui()
  }
  function enter(place:Place,map:District){
    const built=buildTown(map)
    location=place;town=built
    const lon=-T.MathUtils.degToRad(place.lon),lat=T.MathUtils.degToRad(place.lat)
    const normal=new T.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon))
    const east=new T.Vector3(Math.sin(lon),0,-Math.cos(lon))
    toQ.setFromRotationMatrix(new T.Matrix4().makeBasis(east,normal,new T.Vector3().crossVectors(east,normal))).invert()
    controls.enabled=false;startCam.copy(camera.position);startLook.copy(controls.target);fromQ.copy(planet.quaternion)
    const [x,z]=town.spawn
    walker.model.position.set(x,groundY(x,z)+8,z);walker.model.rotation.set(0,0,0)
    scene.add(town.root,walker.model);walker.model.visible=false;town.root.visible=false
    mode='landing';landing=0;heading=.4;wanderTime=0;front=false;selected=false
    ui();resize()
  }
  const wizard=setupMoveIn(root,walker,enter)
  get('[data-join]').onclick=()=>{walker.model.visible=true;wizard.open()}
  get('[data-home]').onclick=reset
  function choose(){
    if(mode!=='auto')return
    selected=!selected;ui()
  }
  select.onclick=choose
  const ray=new T.Raycaster(),mouse=new T.Vector2()
  let pressX=0,pressY=0
  canvas.addEventListener('pointerdown',e=>{pressX=e.clientX;pressY=e.clientY})
  canvas.addEventListener('pointerup',e=>{
    if(mode!=='auto'||Math.hypot(e.clientX-pressX,e.clientY-pressY)>8)return
    const box=canvas.getBoundingClientRect()
    mouse.set((e.clientX-box.left)*2/box.width-1,1-(e.clientY-box.top)*2/box.height)
    ray.setFromCamera(mouse,camera)
    if(ray.intersectObject(walker.model,true).length)choose()
    else {selected=false;ui()}
  })
  get('[data-manual]').onclick=()=>{mode='manual';selected=false;front=false;held.clear();ui();canvas.focus()}
  view.onclick=()=>{front=!front;ui();canvas.focus()}
  function resume(){mode='auto';selected=false;held.clear();ui();canvas.focus()}
  get('[data-auto]').onclick=resume;get('[data-goodbye]').onclick=resume
  get('[data-talk]').onclick=()=>{
    mode='chat';selected=false;chatIndex=0
    get('[data-line]').textContent='안녕! 같이 한 바퀴 걸을래? 오늘은 어느 길로 가 볼까?';ui()
    get('[data-near]').focus()
  }
  get('[data-near]').onclick=()=>{
    const p=walker.model.position
    const nearest=town?.signs.slice().sort((a,b)=>Math.hypot(a.point[0]-p.x,a.point[1]-p.z)-Math.hypot(b.point[0]-p.x,b.point[1]-p.z))??[]
    const spot=nearest[chatIndex++%Math.max(1,nearest.length)]
    get('[data-line]').textContent=spot?'여기서 '+spot.name+'까지 '+Math.round(Math.hypot(spot.point[0]-p.x,spot.point[1]-p.z)*260/23)+'m쯤이야. '+(spot.kind==='station'?'역 근처라 길 찾기 좋겠다!':'천천히 걸으면서 구경해 보자.'):'지도에 이름이 붙은 장소는 드물어. 이 길을 따라 조금 더 걸어 볼까?'
  }
  const aliases:Record<string,string>={w:'ArrowUp',s:'ArrowDown',a:'ArrowLeft',d:'ArrowRight'}
  const arrows=['ArrowUp','ArrowDown','ArrowRight','ArrowLeft']
  function key(e:KeyboardEvent,down:boolean){
    if(!active||mode!=='manual')return
    const k=aliases[e.key.toLowerCase()]||e.key
    if(!arrows.includes(k))return
    e.preventDefault();if(down)held.add(k);else held.delete(k)
  }
  window.addEventListener('keydown',e=>key(e,true));window.addEventListener('keyup',e=>key(e,false))
  window.addEventListener('blur',()=>held.clear())
  for(const button of pad.querySelectorAll<HTMLButtonElement>('button')){
    const k=button.dataset.key!
    button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.add(k)}
    button.onlostpointercapture=()=>held.delete(k)
  }
  function walk(dt:number){
    const p=walker.model.position
    let distance=0
    if(mode==='manual'){
      heading+=((held.has('ArrowLeft')?1:0)-(held.has('ArrowRight')?1:0))*2.5*dt
      distance=((held.has('ArrowUp')?1:0)-(held.has('ArrowDown')?1:0))*3*dt
    }else if(mode==='auto'){
      wanderTime-=dt
      if(wanderTime<=0){heading+=(Math.random()-.5)*1.15;wanderTime=2+Math.random()*4}
      distance=1.75*dt
    }
    let moving=false
    if(distance){
      const x=p.x+Math.sin(heading)*distance,z=p.z+Math.cos(heading)*distance
      if(town!.canWalk(x,z)){p.set(x,groundY(x,z),z);moving=true}
      else if(mode==='auto'){heading+=1.8+Math.random()*.8;wanderTime=1.5}
    }
    walker.model.rotation.y=heading;walker.pose(dt,moving)
    lookAt.copy(p);lookAt.y+=1.25
    if(mode==='manual'){
      const side=front?1:-1
      cameraGoal.set(side*6.6*Math.sin(heading),3.6,side*6.6*Math.cos(heading)).add(p)
    }else cameraGoal.copy(p).add(worldPos.set(3,6.7,9))
    camera.position.lerp(cameraGoal,1-Math.exp(-dt*6))
    look.lerp(lookAt,1-Math.exp(-dt*8));camera.lookAt(look)
    camera.updateMatrixWorld()
    if(!actions.hidden){
      worldPos.copy(p);worldPos.y+=2.65;worldPos.project(camera)
      const x=T.MathUtils.clamp((worldPos.x*.5+.5)*canvas.clientWidth,actions.offsetWidth/2,canvas.clientWidth-actions.offsetWidth/2)
      const y=(.5-worldPos.y*.5)*canvas.clientHeight
      actions.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-100%)'
    }
  }
  function draw(now:number){
    if(!active)return
    const dt=Math.min(.06,(now-last)/1000);last=now
    if(mode==='globe'){
      if(!get<HTMLDialogElement>('dialog').open)planet.rotation.y+=dt*.055
      controls.update()
    }else if(mode==='landing'){
      landing+=dt
      const fly=T.MathUtils.smoothstep(landing,0,1.8),p=walker.model.position
      planet.quaternion.slerpQuaternions(fromQ,toQ,fly)
      const ground=groundY(p.x,p.z)
      cameraGoal.set(p.x+3,ground+6.7,p.z+9)
      camera.position.lerpVectors(startCam,cameraGoal,fly)
      look.lerpVectors(startLook,lookAt.set(p.x,ground+1.25,p.z),fly);camera.lookAt(look)
      town!.root.visible=fly>.88
      if(landing>=1.78){
        stars.visible=false;scene.fog??=new T.FogExp2('#cce3d2',.018)
        walker.model.visible=true;p.y=ground+8*(1-T.MathUtils.clamp((landing-1.78)/.95,0,1)**2)
        if(landing>=2.73){p.y=ground;mode='auto';ui()}
      }
    }else walk(dt)
    renderer.render(scene,camera);frame=requestAnimationFrame(draw)
  }
  reset()
  const observer=new ResizeObserver(resize)
  return {setActive(next:boolean){
    if(active===next)return
    active=next
    if(active){observer.observe(canvas);resize();last=performance.now();draw(last)}
    else{held.clear();observer.disconnect();cancelAnimationFrame(frame);wizard.stop()}
  }}
}
