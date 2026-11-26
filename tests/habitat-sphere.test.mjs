import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3, Quaternion } from 'three'
import { advance, earthRadius, initialForward, mapNormal, mapPoint, miniatureScale, orient } from '../src/habitat-sphere.ts'

test('walk one circumference through both poles and the underside without changing stride or up',()=>{
  const start=mapNormal(0,0),up=start.clone(),forward=initialForward(up,0)
  const next=new Vector3(),direction=new Vector3(),q=new Quaternion()
  for(let i=1;i<=720;i++){
    advance(up,forward,Math.PI*2*earthRadius/720,next,direction)
    up.copy(next);forward.copy(direction)
    orient(up,forward,q)
    assert.ok(new Vector3(0,1,0).applyQuaternion(q).distanceTo(up)<1e-9)
    assert.ok(new Vector3(0,0,1).applyQuaternion(q).distanceTo(forward)<1e-9)
    assert.ok(Math.abs(up.dot(forward))<1e-10)
    if(i===360)assert.ok(up.dot(start)<-.999999)
  }
  assert.ok(up.distanceTo(start)<1e-9)
  assert.equal(miniatureScale,2)
})

test('surface coordinates join across the longitude seam, including reverse travel',()=>{
  const up=mapNormal(22.99,0),dir=initialForward(up,Math.PI/2)
  const next=new Vector3(),heading=new Vector3()
  advance(up,dir,.3,next,heading)
  assert.ok(mapPoint(next)[0]<0)
  assert.ok(mapNormal(...mapPoint(next)).distanceTo(next)<1e-9)
  advance(next.clone(),heading.clone(),-.3,next,heading)
  assert.ok(next.distanceTo(up)<1e-9)
  assert.ok(heading.distanceTo(dir)<1e-9)
})
