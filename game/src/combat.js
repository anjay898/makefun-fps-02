import * as THREE from 'three';
import {WEAPONS,GRENADES,PALETTE} from './config.js';
import {damageActor} from './actors.js';
export const makeWeapon=key=>({key,mag:WEAPONS[key].mag,reserve:WEAPONS[key].reserve||0,nextAt:0,reloadEnd:0,bloom:0});
export const spreadFor=(w,s,c)=>WEAPONS[w.key].spread*(1+s*.55)*(c?.55:1)+w.bloom;
export function startReload(w,n){
const d=WEAPONS[w.key];
if(w.key==='knife'||w.mag>=d.mag||!w.reserve||w.reloadEnd)return false;
w.reloadEnd=n+d.reloadMs;return true;
}
export function stepWeapon(w,n,dt=1/60){
if(w.reloadEnd&&n>=w.reloadEnd){
const a=Math.min(WEAPONS[w.key].mag-w.mag,w.reserve);
w.mag+=a;w.reserve-=a;w.reloadEnd=0;
}w.bloom*=Math.pow(.86,dt*60);
}
export function fire(w,n){
const d=WEAPONS[w.key],k=w.key==='knife';
if((!k&&w.mag<=0)||n<w.nextAt||w.reloadEnd)return false;
if(!k)w.mag--;
w.nextAt=n+60000/d.rpm;w.bloom=Math.min(.03,w.bloom+d.recoil*8);return true;
}
export function buildViewModel(camera){
const group=new THREE.Group();camera.add(group);group.position.set(.27,-.25,-.58);group.scale.setScalar(.85);
const box=(x,y,z,c)=>{
const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),new THREE.MeshStandardMaterial({color:c}));
group.add(m);return m;
};
const body=box(.09,.14,.5,PALETTE.steel||0x29333c),barrel=box(.045,.045,.32,0x151a20),tip=box(.055,.055,.035,PALETTE.ember||0xff582b),scope=box(.055,.06,.18,0x151a20),blade=box(.025,.065,.38,0xbccbd2);
scope.position.set(0,.11,-.05);blade.position.z=-.15;
const f=new THREE.Mesh(new THREE.OctahedronGeometry(.05),new THREE.MeshBasicMaterial({color:0xffc37a}));
group.add(f);f.visible=false;
let t=0,lit=0;
function setWeapon(k){
const knife=k==='knife',s=k==='sniper',p=k==='pistol';
body.visible=barrel.visible=tip.visible=!knife;blade.visible=knife;scope.visible=s;
body.scale.set(k==='shotgun'?1.5:1,1,p?.6:1);
body.material.color.set(k==='shotgun'?0x493b33:PALETTE.steel||0x29333c);
barrel.scale.z=s?1.8:p?.45:1;
barrel.position.z=-(p?.15:.25)-.16*barrel.scale.z;
tip.position.z=barrel.position.z-.16*barrel.scale.z;
f.position.z=tip.position.z-.04;lit=0;f.visible=false;
}
setWeapon('pistol');
return {group,setWeapon,kick(){t=1;},flash(){lit=.04;f.visible=true;},update(dt){
t=Math.max(0,t-dt*9);lit-=dt;f.visible=lit>0;
group.position.z=-.58+t*.06;group.rotation.x=t*.12;
}};
}
export function createTracers(scene){
const pool=Array.from({length:24},()=>{
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:PALETTE.ink||0x99ccff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
l.visible=false;l.frustumCulled=false;scene.add(l);return {l,life:0};
});let i=0;
return {spawn(a,b,c=PALETTE.ink||0x99ccff){
const q=pool[i++%24],p=q.l.geometry.attributes.position;
p.setXYZ(0,a.x,a.y,a.z);p.setXYZ(1,b.x,b.y,b.z);p.needsUpdate=true;
q.l.material.color.set(c);q.l.material.opacity=1;q.l.visible=true;q.life=.05;
},update(dt){for(const q of pool){q.life-=dt;q.l.visible=q.life>0;q.l.material.opacity=Math.max(0,q.life/.05);}}};
}
export function createNades(scene,colliders,actors,onEvent){
const v=new THREE.Vector3(),p=new THREE.Vector3(),hit=new THREE.Vector3(),old=new THREE.Vector3(),fv=new THREE.Vector3(),ray=new THREE.Ray(),geo=new THREE.SphereGeometry(.09,10,8);
const pool=Array.from({length:12},()=>{
const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({transparent:true,depthWrite:false}));
m.visible=false;scene.add(m);return {m,v:new THREE.Vector3(),age:0,state:0,type:''};
});
const blocked=(a,b)=>{
v.subVectors(b,a);const d=v.length();if(!d)return false;
ray.set(a,v.multiplyScalar(1/d));
for(const c of colliders)if(ray.intersectBox(c,hit)&&hit.distanceTo(a)<d)return true;
return false;
};let i=0;
return {throwNade(type,from,dir,speed=16){
const q=pool[i++%pool.length];q.type=type;q.age=0;q.state=1;q.v.copy(dir).multiplyScalar(speed);q.v.y+=3;
q.m.position.copy(from);q.m.scale.setScalar(1);q.m.visible=true;q.m.material.opacity=1;q.m.material.color.set(type==='frag'?(PALETTE.ember||0xff582b):0xeefaff);
},update(dt,now){
for(const q of pool){
if(!q.state)continue;
q.age+=dt;const m=q.m;
if(q.state===2){
m.scale.setScalar(1+q.age*100);m.material.opacity=Math.max(0,1-q.age/.25);
if(q.age>=.25){q.state=0;m.visible=false;}continue;
}
old.copy(m.position);q.v.y-=12*dt;m.position.addScaledVector(q.v,dt);
if(m.position.y<.09){m.position.y=.09;q.v.y=Math.abs(q.v.y)*.35;q.v.x*=.7;q.v.z*=.7;}
for(const c of colliders){const b=c;if(b.containsPoint(m.position)){
if(old.x<b.min.x||old.x>b.max.x)q.v.x*=-.5;
else if(old.z<b.min.z||old.z>b.max.z)q.v.z*=-.5;
else q.v.y*=-.35;
m.position.copy(old);
}}
if(q.age<(q.type==='frag'?1.4:1.1))continue;
for(const a of actors){
if(!a.alive)continue;
p.copy(a.pos);p.y+=1.2;
const d=p.distanceTo(m.position);
if(q.type==='frag'&&d<5)damageActor(a,90*(1-d/5)*(blocked(m.position,p)?.25:1));
if(q.type==='flash'&&d<14&&!blocked(m.position,p)){
v.subVectors(m.position,p).normalize();
fv.set(-Math.sin(a.yaw)*Math.cos(a.pitch),Math.sin(a.pitch),-Math.cos(a.yaw)*Math.cos(a.pitch));const f=v.dot(fv);
if(f>.2)a.flashUntil=Math.max(a.flashUntil||0,now+2500*f*(1-d/14));
}}
q.state=2;q.age=0;onEvent(q.type,m.position.clone());
}
}};
}