import * as T from 'three'
import { radius, type Point } from './habitat-map.ts'

export const earthRadius=18
export const manualWalkSpeed=2.2
export const sceneryScale=4
export const miniatureScale=.5*sceneryScale

// The middle of the address map faces the initial camera. Opposite edges meet on the far side.
export function mapNormal(x:number,z:number,out=new T.Vector3()){
  const longitude=x*Math.PI/radius
  const latitude=T.MathUtils.clamp(z/radius,-1,1)*Math.PI/2
  return out.set(Math.cos(latitude)*Math.sin(longitude),Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude))
}

export function mapPoint(normal:T.Vector3):Point{
  return [Math.atan2(normal.x,normal.y)*radius/Math.PI,Math.asin(T.MathUtils.clamp(normal.z,-1,1))*2*radius/Math.PI]
}

const axis=new T.Vector3(), right=new T.Vector3(), matrix=new T.Matrix4()
export function initialForward(normal:T.Vector3,angle:number){
  const dir=new T.Vector3(0,0,1).projectOnPlane(normal)
  if(dir.lengthSq()<1e-8)dir.set(1,0,0).projectOnPlane(normal)
  return dir.normalize().applyAxisAngle(normal,angle)
}

// Parallel transport keeps the same heading through both poles and the longitude seam.
export function advance(normal:T.Vector3,forward:T.Vector3,distance:number,next:T.Vector3,nextForward:T.Vector3){
  axis.crossVectors(normal,forward).normalize()
  const angle=distance/earthRadius
  next.copy(normal).applyAxisAngle(axis,angle).normalize()
  nextForward.copy(forward).applyAxisAngle(axis,angle).projectOnPlane(next).normalize()
}

export function orient(up:T.Vector3,forward:T.Vector3,out:T.Quaternion){
  right.crossVectors(up,forward).normalize()
  return out.setFromRotationMatrix(matrix.makeBasis(right,up,forward))
}
