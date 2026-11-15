import * as THREE from 'three';
import {PALETTE} from './config.js';
const RADIUS=.34,STAND_H=1.72,CROUCH_H=1.12,STAND_EYE=1.6,CROUCH_EYE=1.02,WALK=5,CROUCH_SPEED=2.3,ACCEL=40,AIR_ACCEL=8,FRICTION=9,GRAVITY=20,JUMP=6;
const probe=new THREE.Box3(),wish=new THREE.Vector3();
export function createActor(x,z,team,isPlayer){
return {pos:new THREE.Vector3(x,0,z),vel:new THREE.Vector3(),yaw:0,pitch:0,hp:100,alive:true,team,isPlayer,crouch:false,height:STAND_H,eye:STAND_EYE,onGround:true,speedNow:0,group:null,parts:{head:null,torso:null,legs:[]},flashUntil:0};
}
export function buildBody(a,scene){
const g=new THREE.Group(),team=new THREE.MeshStandardMaterial({color:a.team==='atk'?PALETTE.ember:PALETTE.warden}),steel=new THREE.MeshStandardMaterial({color:0x303943,roughness:.8}),skin=new THREE.MeshStandardMaterial({color:0xc9a189});
function box(w,h,d,x,y,z,mat,part,parent=g){
const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
m.position.set(x,y,z);m.userData.actor=a;m.userData.part=part;m.castShadow=true;parent.add(m);return m;
}
a.parts.legs=[box(.22,.8,.26,-.17,.4,0,steel,'legs'),box(.22,.8,.26,.17,.4,0,steel,'legs')];
a.parts.torso=box(.62,.72,.34,0,1.16,0,team,'torso');
a.parts.head=box(.34,.34,.34,0,1.77,0,skin,'head');
box(.36,.06,.36,0,.2,0,team,'head',a.parts.head);
a.group=g;scene.add(g);syncBody(a);return g;
}
export function syncBody(a){
const g=a.group;if(!g)return;
g.position.copy(a.pos);g.rotation.y=a.yaw;g.rotation.z=a.alive?0:Math.PI/2;
if(!a.alive)g.position.y+=.34;
if(a.parts.head)a.parts.head.position.y=a.crouch?1.19:1.77;
if(a.parts.torso)a.parts.torso.position.y=a.crouch?.68:1.16;
}
function blocked(a,colliders){
probe.min.set(a.pos.x-RADIUS,a.pos.y+.05,a.pos.z-RADIUS);
probe.max.set(a.pos.x+RADIUS,a.pos.y+a.height-.05,a.pos.z+RADIUS);
for(let i=0;i<colliders.length;i++)if(probe.intersectsBox(colliders[i]))return true;
return false;
}
export function stepActor(a,wishX,wishZ,dt,colliders,jump){
if(!a.alive)return;
a.height=a.crouch?CROUCH_H:STAND_H;
wish.set(wishX,0,wishZ);
const moving=wish.lengthSq()>0;
if(moving){
wish.normalize().multiplyScalar(a.crouch?CROUCH_SPEED:WALK);
wish.x-=a.vel.x;wish.z-=a.vel.z;
const len=wish.length(),step=(a.onGround?ACCEL:AIR_ACCEL)*dt;
if(len>step)wish.multiplyScalar(step/len);
a.vel.x+=wish.x;a.vel.z+=wish.z;
}else if(a.onGround){
const decay=Math.exp(-FRICTION*dt);a.vel.x*=decay;a.vel.z*=decay;
}
if(jump&&a.onGround){a.vel.y=JUMP;a.onGround=false;}
a.vel.y-=GRAVITY*dt;
const x=a.pos.x;a.pos.x+=a.vel.x*dt;
if(blocked(a,colliders)){a.pos.x=x;a.vel.x=0;}
const z=a.pos.z;a.pos.z+=a.vel.z*dt;
if(blocked(a,colliders)){a.pos.z=z;a.vel.z=0;}
a.pos.y+=a.vel.y*dt;
if(a.pos.y<=0){a.pos.y=0;a.vel.y=0;a.onGround=true;}
else a.onGround=false;
a.eye=THREE.MathUtils.lerp(a.eye,a.crouch?CROUCH_EYE:STAND_EYE,1-Math.exp(-14*dt));
a.speedNow=Math.hypot(a.vel.x,a.vel.z);
syncBody(a);
}
export function damageActor(a,dmg){
if(!a.alive)return false;
a.hp-=dmg;
if(a.hp>0)return false;
a.alive=false;a.vel.set(0,0,0);a.speedNow=0;syncBody(a);return true;
}