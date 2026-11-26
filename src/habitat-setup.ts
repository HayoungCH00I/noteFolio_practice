import * as T from 'three'
import { searchAddress, loadDistrict, type District, type Place } from './habitat-map.ts'
import type { loadWalker } from './habitat-resident.ts'

export function setupMoveIn(root:HTMLElement,walker:Awaited<ReturnType<typeof loadWalker>>,enter:(place:Place,map:District)=>void){
  const get=<E extends HTMLElement>(s:string)=>root.querySelector<E>(s)!
  const dialog=get<HTMLDialogElement>('dialog'),video=get<HTMLVideoElement>('video'),file=get<HTMLInputElement>('[data-art]')
  const cameraButton=get<HTMLButtonElement>('[data-camera]'),shoot=get<HTMLButtonElement>('[data-shoot]')
  const message=get('[data-message]'),results=get('[data-results]'),address=get<HTMLInputElement>('[data-address]')
  const preview=get<HTMLCanvasElement>('[data-preview]'),next=get<HTMLButtonElement>('[data-next]')
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,20)
  scene.add(new T.HemisphereLight(0xfff7df,0xd4cab9,2))
  const light=new T.DirectionalLight(0xfff3d8,2);light.position.set(2,4,3);scene.add(light)
  camera.position.set(.3,1.45,4.65);camera.lookAt(0,1.18,0)
  let renderer:T.WebGLRenderer|undefined,stream:MediaStream|undefined,request:AbortController|undefined
  let cameraVersion=0,uploadVersion=0
  function paint(){
    if(!dialog.open||!preview.clientWidth)return
    renderer??=new T.WebGLRenderer({canvas:preview,alpha:true,antialias:true})
    renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.setSize(preview.clientWidth,preview.clientHeight,false)
    camera.aspect=preview.clientWidth/preview.clientHeight;camera.updateProjectionMatrix();renderer.render(scene,camera)
  }
  new ResizeObserver(paint).observe(preview)
  function stopCamera(){
    cameraVersion++;stream?.getTracks().forEach(t=>t.stop());stream=undefined
    video.srcObject=null;video.hidden=true;shoot.hidden=true;cameraButton.disabled=false
  }
  function stop(){
    stopCamera();uploadVersion++;request?.abort();request=undefined
    if(dialog.open)dialog.close()
  }
  function step(skin:boolean){
    get('[data-skin-step]').hidden=!skin;get('[data-address-step]').hidden=skin
    get('#habitat-title').textContent=skin?'캐릭터 만들기':'걸어갈 동네 찾기'
    message.textContent=skin?'사진을 넣으면 얼굴과 옷에 스킨을 입혀요.':'주소 검색 결과에서 산책할 위치를 골라 주세요.'
    if(skin)paint();else {stopCamera();address.focus()}
  }
  function applyImage(image:CanvasImageSource,w:number,h:number,mirror=false){
    const portrait=document.createElement('canvas');portrait.width=portrait.height=512
    const ctx=portrait.getContext('2d')!,s=Math.min(w,h)
    if(mirror){ctx.translate(512,0);ctx.scale(-1,1)}
    ctx.drawImage(image,(w-s)/2,(h-s)/2,s,s,0,0,512,512)
    walker.skin(portrait);paint();message.textContent='스킨을 입혔어요. 동네를 골라 주세요.'
  }
  file.onchange=async()=>{
    const selected=file.files?.[0];if(!selected)return
    stopCamera();const version=++uploadVersion,url=URL.createObjectURL(selected);next.disabled=true
    try{
      const img=new Image();img.src=url;await img.decode()
      if(version===uploadVersion)applyImage(img,img.width,img.height)
    }catch{if(version===uploadVersion)message.textContent='이미지를 읽지 못했어요. 다른 파일을 골라 주세요.'}
    finally{URL.revokeObjectURL(url);if(version===uploadVersion)next.disabled=false}
  }
  cameraButton.onclick=async()=>{
    const version=++cameraVersion;cameraButton.disabled=true
    try{
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})
      if(version!==cameraVersion){media.getTracks().forEach(t=>t.stop());return}
      stream=media;video.srcObject=media;video.hidden=false;await video.play()
      if(version===cameraVersion){shoot.hidden=false;message.textContent='화면 중앙에 얼굴을 맞추고 찍어 주세요.'}
    }catch{if(version===cameraVersion){stopCamera();message.textContent='카메라 권한과 HTTPS 연결을 확인하거나 사진 파일을 골라 주세요.'}}
  }
  shoot.onclick=()=>{if(video.videoWidth){applyImage(video,video.videoWidth,video.videoHeight,true);stopCamera()}}
  next.onclick=()=>step(false)
  function cancelRequest(){request?.abort();request=undefined;results.replaceChildren()}
  get('[data-back]').onclick=()=>{cancelRequest();step(true)}
  address.oninput=cancelRequest
  get<HTMLFormElement>('[data-search]').onsubmit=async event=>{
    event.preventDefault();const query=address.value.trim();if(!query)return
    cancelRequest();const operation=new AbortController();request=operation
    message.textContent='실제 지도에서 주소를 찾고 있어요.'
    try{
      const places=await searchAddress(query,operation.signal)
      if(operation.signal.aborted)return
      message.textContent=places.length?'내가 찾는 위치를 골라 주세요.':'결과가 없어요. 도로명이나 근처 역 이름을 입력해 주세요.'
      for(const place of places){
        const button=document.createElement('button');button.type='button';button.textContent=place.name
        button.onclick=async()=>{
          request?.abort();const load=new AbortController();request=load
          message.textContent='주변 도로와 건물, 장소를 읽고 있어요.'
          try{
            const map=await loadDistrict(place,load.signal)
            if(load.signal.aborted)return
            enter(place,map);stop()
          }catch(error){if(!load.signal.aborted)message.textContent=error instanceof Error&&/[가-힣]/.test(error.message)?error.message:'지도를 불러오지 못했어요. 위치를 다시 선택해 주세요.'}
        }
        results.append(button)
      }
    }catch{if(!operation.signal.aborted)message.textContent='주소 검색에 연결하지 못했어요. 잠시 후 다시 검색해 주세요.'}
  }
  get('.habitat-close').onclick=stop;dialog.addEventListener('close',stop)
  return {stop,open(){
    next.disabled=false;file.value='';address.value='';results.replaceChildren()
    scene.add(walker.model);walker.model.position.set(0,0,0);walker.model.rotation.set(0,0,0);walker.pose(0,false)
    dialog.showModal();step(true)
  }}
}
