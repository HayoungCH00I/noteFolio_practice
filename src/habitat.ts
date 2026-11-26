import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import sample from './assets/habitat-cheonggye.json'
import { loadWalkers } from './habitat-resident.ts'
import { setupMoveIn } from './habitat-setup.ts'
import { buildTown } from './habitat-town.ts'
import { advance, earthRadius, initialForward, mapNormal, mapPoint, manualWalkSpeed, miniatureScale, orient, sceneryScale } from './habitat-sphere.ts'
import { districtMeters, radius, type Place, type District } from './habitat-map.ts'

import type { Season } from './habitat-seasons.ts'

export async function createHabitat(root:HTMLElement){
  const makeWalker=await loadWalkers()
  const people=['내 캐릭터','봄','산들','여름','나루'].map((name,index)=>({
    name,index,avatar:makeWalker(index),normal:new T.Vector3(),forward:new T.Vector3(),wander:1+index*.6,
  }))
  const draft=makeWalker(0)
  let person=people[0],walker=person.avatar
  const get=<E extends HTMLElement>(s:string)=>root.querySelector<E>(s)!
  const canvas=get<HTMLCanvasElement>('.habitat-world'),scene=new T.Scene()
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
  const camera=new T.PerspectiveCamera(37,1,.12,2000)
  const controls=new OrbitControls(camera,canvas)
  controls.enablePan=false;controls.enableDamping=true
  controls.minDistance=earthRadius*1.2;controls.maxDistance=earthRadius*5
  const planet=new T.Group();scene.add(planet)
  const surface=planet
  const example=buildTown(sample as District);surface.add(example.root)
  scene.add(new T.HemisphereLight(0xfff6df,0xe0e9dc,1.42),new T.AmbientLight(0xfff6e8,.35))
  const sun=new T.DirectionalLight(0xffefd2,2.1);sun.position.set(-28,48,30);sun.castShadow=true
  Object.assign(sun.shadow.camera,{left:-33,right:33,top:33,bottom:-33,near:1,far:110})
  sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.001;sun.shadow.normalBias=.035
  scene.add(sun)
  type Mode='globe'|'landing'|'auto'|'manual'|'chat'
  let mode:Mode='globe',town:ReturnType<typeof buildTown>|undefined,location:Place|undefined
  let active=false,frame=0,last=0,landing=0,front=false,selected=false,chatIndex=0
  const held=new Set<string>(),actions=get('[data-actions]'),toolbar=get('[data-toolbar]'),pad=get('[data-pad]'),chat=get('[data-chat]')
  const scope=get('[data-location]'),view=get('[data-view]'),select=get('[data-select]')
  const seasonMenu=get<HTMLSelectElement>('[data-season]')
  let season:Season='spring'
  function applySeason(){
    root.dataset.season=season
    example.setSeason(season)
    if(town && town!==example)town.setSeason(season)
  }
  seasonMenu.onchange=()=>{season=seasonMenu.value as Season;applySeason()}
  applySeason()
  const roster=get<HTMLSelectElement>('[data-roster]')
  function populate(t:ReturnType<typeof buildTown>,includePlayer:boolean){
    roster.replaceChildren()
    for(const who of people){
      const pt=who.index===0?(includePlayer?t.spawn:undefined):t.homes[who.index-1]
      const avatar=who.avatar
      avatar.model.visible=!!pt
      if(!pt)continue
      mapNormal(...pt,who.normal);who.forward.copy(initialForward(who.normal,who.index*1.67))
      surface.add(avatar.model);avatar.model.position.copy(who.normal).multiplyScalar(t.floor(who.normal))
      avatar.model.scale.setScalar(miniatureScale);orient(who.normal,who.forward,avatar.model.quaternion)
      avatar.pose(0,false);roster.add(new Option(who.name,String(who.index)))
    }
    roster.value=includePlayer?'0':roster.options[0]?.value??''
  }
  const cameraGoal=new T.Vector3(),look=new T.Vector3(),worldPos=new T.Vector3(),lookAt=new T.Vector3()
  const startCam=new T.Vector3(),startLook=new T.Vector3(),fromQ=new T.Quaternion(),toQ=new T.Quaternion()
  const wideEye=new T.Vector3(.57,3.65,1.98).multiplyScalar(earthRadius),wideLook=new T.Vector3()
  function resize(){
    if(!canvas.clientWidth||!canvas.clientHeight)return
    camera.aspect=canvas.clientWidth/canvas.clientHeight
    camera.zoom=mode==='globe'||mode==='auto'||mode==='landing'?Math.min(1,camera.aspect*.94):1
    camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false)
  }
  function ui(){
    const local=mode!=='globe'
    root.classList.toggle('habitat-town',local)
    get('footer').hidden=local;get('.habitat-credit').hidden=false
    toolbar.hidden=mode==='landing'||mode==='chat'
    get('[data-home]').hidden=!local
    roster.hidden=mode!=='auto' && mode!=='globe'
    pad.hidden=mode!=='manual';view.hidden=pad.hidden;get('[data-auto]').hidden=pad.hidden
    view.textContent=front?'뒷모습 보기':'앞모습 보기'
    select.hidden=roster.hidden||(selected && actions.style.visibility!=='hidden');actions.hidden=mode!=='auto'||!selected
    chat.hidden=mode!=='chat'
    scope.textContent=local?(location?.name??'')+(mode==='manual'?' · ↑↓ 걷기 · ←→ 돌기':mode==='auto'?' · 주민을 눌러 보세요':''):'서울 청계천 일대 · 드래그로 회전 · 휠이나 두 손가락으로 확대'
  }
  function reset(){
    mode='globe';selected=false;held.clear();people[0].avatar.model.removeFromParent()
    if(town && town!==example){town.root.removeFromParent();town.dispose()}
    town=undefined;populate(example,false)
    location=undefined;scene.fog=null;example.root.visible=true
    planet.rotation.set(0,.7,0)
    controls.enabled=true;controls.target.copy(planet.position)
    camera.position.copy(wideEye);camera.up.set(0,1,0)
    controls.update();resize();ui()
  }
  function enter(place:Place,map:District){
    const built=buildTown(map)
    location=place;town=built;built.setSeason(season);person=people[0];walker=person.avatar;walker.copySkin(draft);populate(built,true)
    example.root.visible=false;toQ.identity()
    controls.enabled=false;startCam.copy(camera.position);startLook.copy(controls.target);fromQ.copy(planet.quaternion)
    walker.model.position.addScaledVector(person.normal,4)
    surface.add(town.root,walker.model);walker.model.visible=false;town.root.visible=true
    mode='landing';landing=0;person.wander=0;front=false;selected=false
    ui();resize()
  }
  const wizard=setupMoveIn(root,draft,enter)
  get('[data-join]').onclick=()=>wizard.open(people[0].avatar,0)
  get('[data-skin]').onclick=()=>{selected=false;ui();wizard.open(walker,person.index,true)}
  get('[data-home]').onclick=reset
  function choose(who:typeof person){
    if(mode==='globe'){
      town=example;location={name:'서울 청계천 일대',lat:37.56878,lon:126.98492}
      camera.position.sub(wideLook).applyAxisAngle(new T.Vector3(0,1,0),-planet.rotation.y).add(wideLook)
      planet.rotation.y=0;mode='auto'
    }
    if(mode!=='auto')return
    person=who;walker=person.avatar;selected=true;roster.value=String(person.index)
    if(camera.position.dot(who.normal)<earthRadius+2){
      const length=camera.position.length()
      camera.position.copy(who.normal).multiplyScalar(length);controls.target.copy(wideLook);controls.update()
    }
    ui()
  }
  select.onclick=()=>choose(people[Number(roster.value)])
  roster.onchange=()=>choose(people[Number(roster.value)])
  const ray=new T.Raycaster(),mouse=new T.Vector2()
  let pressX=0,pressY=0
  canvas.addEventListener('pointerdown',e=>{pressX=e.clientX;pressY=e.clientY})
  canvas.addEventListener('pointerup',e=>{
    if((mode!=='auto' && mode!=='globe')||Math.hypot(e.clientX-pressX,e.clientY-pressY)>8)return
    const box=canvas.getBoundingClientRect()
    mouse.set((e.clientX-box.left)*2/box.width-1,1-(e.clientY-box.top)*2/box.height)
    ray.setFromCamera(mouse,camera)
    const visible=people.filter(p=>p.avatar.model.visible)
    // A small touch target around the torso is easier to pick in the globe overview.
    let nearest:typeof person|undefined,min=Infinity
    for(const who of visible){
      const pos=who.avatar.model.localToWorld(worldPos.set(0,1.35,0))
      if(pos.dot(camera.position)<earthRadius**2)continue
      const t=ray.ray.distanceSqToPoint(pos)
      if(t<.75*sceneryScale**2 && t<min){min=t;nearest=who}
    }
    if(nearest)choose(nearest)
    else {selected=false;ui()}
  })
  get('[data-manual]').onclick=()=>{mode='manual';selected=false;front=false;controls.enabled=false;held.clear();look.copy(walker.model.position).addScaledVector(person.normal,.64*sceneryScale);resize();ui();canvas.focus()}
  view.onclick=()=>{front=!front;ui();canvas.focus()}
  function resume(){camera.up.set(0,1,0);mode='auto';selected=false;held.clear();controls.enabled=true;controls.target.copy(wideLook);camera.position.copy(wideEye);controls.update();resize();ui();canvas.focus()}
  get('[data-auto]').onclick=resume;get('[data-goodbye]').onclick=resume
  get('[data-talk]').onclick=()=>{
    mode='chat';controls.enabled=false;selected=false;chatIndex=0;look.copy(walker.model.position).addScaledVector(person.normal,.64*sceneryScale);resize()
    get('[data-speaker]').textContent=person.name
    get('[data-line]').textContent='안녕! 같이 한 바퀴 걸을래? 오늘은 어느 길로 가 볼까?';ui()
    get('[data-near]').focus()
  }
  get('[data-near]').onclick=()=>{
    const [x,z]=mapPoint(person.normal)
    const nearest=town?.signs.slice().sort((a,b)=>Math.hypot(a.point[0]-x,a.point[1]-z)-Math.hypot(b.point[0]-x,b.point[1]-z))??[]
    const spot=nearest[chatIndex++%Math.max(1,nearest.length)]
    get('[data-line]').textContent=spot?'여기서 '+spot.name+'까지 '+Math.round(Math.hypot(spot.point[0]-x,spot.point[1]-z)*districtMeters/radius)+'m쯤이야. '+(spot.kind==='station'?'역 근처라 길 찾기 좋겠다!':'천천히 걸으면서 구경해 보자.'):'지도에 이름이 붙은 장소는 드물어. 이 길을 따라 조금 더 걸어 볼까?'
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
  const nextNormal=new T.Vector3(),nextForward=new T.Vector3()
  function moveResidents(dt:number){
    const neighborhood=town??example
    for(const who of people){
      const avatar=who.avatar,p=avatar.model.position
      if(!avatar.model.visible || (mode==='landing' && who.index===0))continue
      const manual=mode==='manual' && who===person
      let distance=0
      if(manual){
        who.forward.applyAxisAngle(who.normal,((held.has('ArrowLeft')?1:0)-(held.has('ArrowRight')?1:0))*2.5*dt)
        distance=((held.has('ArrowUp')?1:0)-(held.has('ArrowDown')?1:0))*manualWalkSpeed*dt
      }else if(mode!=='chat' || who!==person){
        who.wander-=dt
        if(who.wander<=0){who.forward.applyAxisAngle(who.normal,(Math.random()-.5)*1.15);who.wander=2+Math.random()*4}
        distance=(1.5+who.index*.08)*.5*dt
      }
      let moving=false
      if(distance){
        advance(who.normal,who.forward,distance,nextNormal,nextForward)
        if(neighborhood.canWalk(nextNormal)){
          who.normal.copy(nextNormal);who.forward.copy(nextForward);moving=true
          p.copy(who.normal).multiplyScalar(neighborhood.floor(who.normal))
        }else if(!manual){who.forward.applyAxisAngle(who.normal,1.8+Math.random()*.8);who.wander=1.5}
      }
      orient(who.normal,who.forward,avatar.model.quaternion);avatar.pose(dt,moving)
    }
  }
  function follow(dt:number){
    const p=walker.model.position
    if(mode==='auto')controls.update()
    else{
      lookAt.copy(p).addScaledVector(person.normal,.64*sceneryScale)
      const side=mode==='chat'||front?1:-1
      cameraGoal.copy(p).addScaledVector(person.normal,(mode==='chat'?2.7:2.15)*sceneryScale)
        .addScaledVector(person.forward,side*(mode==='chat'?4.9:4.2)*sceneryScale)
      town!.clearCamera(lookAt,cameraGoal)
      camera.up.copy(person.normal)
      if(camera.position.dot(person.normal)<earthRadius || camera.position.distanceTo(cameraGoal)>18)camera.position.copy(cameraGoal)
      else camera.position.lerp(cameraGoal,1-Math.exp(-dt*8))
      // Keep the camera outside the surface through sharp turns and POV switches.
      if(camera.position.length()<earthRadius+.6)camera.position.setLength(earthRadius+.6)
      look.lerp(lookAt,1-Math.exp(-dt*9));camera.lookAt(look)
    }
    camera.updateMatrixWorld()
    if(!actions.hidden){
      worldPos.copy(p).addScaledVector(person.normal,1.36*sceneryScale)
      const behindSurface=person.normal.dot(camera.position)<earthRadius
      actions.style.visibility=behindSurface?'hidden':'visible'
      select.hidden=!behindSurface
      worldPos.project(camera)
      const x=T.MathUtils.clamp((worldPos.x*.5+.5)*canvas.clientWidth,actions.offsetWidth/2,canvas.clientWidth-actions.offsetWidth/2)
      const y=(.5-worldPos.y*.5)*canvas.clientHeight
      actions.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-100%)'
    }
  }
  function draw(now:number){
    if(!active)return
    const dt=T.MathUtils.clamp((now-last)/1000,0,.06);last=now
    const editing=get<HTMLDialogElement>('dialog').open
    if(!editing)moveResidents(dt)
    if(mode==='globe'){
      if(!editing)planet.rotation.y+=dt*.095
      controls.update()
    }else if(mode==='landing'){
      landing+=dt
      const fly=T.MathUtils.smoothstep(landing,0,1.8),p=walker.model.position
      planet.quaternion.slerpQuaternions(fromQ,toQ,fly)
      const ground=town!.floor(person.normal)
      camera.position.lerpVectors(startCam,wideEye,fly)
      look.lerpVectors(startLook,wideLook,fly);camera.lookAt(look)
      if(landing>=1.78){
        walker.model.visible=true;p.copy(person.normal).multiplyScalar(ground+4*(1-T.MathUtils.clamp((landing-1.78)/.95,0,1)**2))
        if(landing>=2.73){p.copy(person.normal).multiplyScalar(ground);mode='auto';controls.target.copy(wideLook);controls.enabled=true;controls.update();ui()}
      }
    }else follow(dt)
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
