import * as THREE from 'three';
import {PALETTE,BOXES,SITE} from './config.js';
export function buildMap(scene){
const colliders=[],shootables=[],materials={};
for(const k of ['steel','concrete','ember','warden'])materials[k]=new THREE.MeshStandardMaterial({color:k==='concrete'?'#4a4238':PALETTE[k],roughness:.85});
const mesh=(g,m,x,y,z,shadow=true)=>{
const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;scene.add(o);return o;
};
scene.background=new THREE.Color(PALETTE.canvas);
scene.fog=new THREE.Fog(PALETTE.canvas,36,92);
const floor=mesh(new THREE.PlaneGeometry(44,36),new THREE.MeshStandardMaterial({color:'#2a2f38',roughness:.95}),0,0,0,false);
floor.rotation.x=-Math.PI/2;
const grid=new THREE.GridHelper(44,44,PALETTE.ember,PALETTE.steel);
grid.material.transparent=true;grid.material.opacity=.12;grid.position.y=.01;scene.add(grid);
for(const {x,z,w,h,d,mat} of BOXES){
shootables.push(mesh(new THREE.BoxGeometry(w,h,d),materials[mat],x,h/2,z));
colliders.push(new THREE.Box3(new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)));
if(mat==='ember'||mat==='warden')mesh(new THREE.BoxGeometry(w+.06,.09,d+.06),materials[mat],x,h+.02,z);
}
scene.add(new THREE.HemisphereLight(0xE8DFC9,0x2a3140,.95));
const sun=new THREE.DirectionalLight(0xffd9b0,2.3);
sun.position.set(18,26,10);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26});
sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);scene.add(sun);
for(const [color,z] of [['ember',-8],['warden',-15],['ember',15]]){
const light=new THREE.PointLight(PALETTE[color],60,20);light.position.set(0,4,z);scene.add(light);
}
const sw=SITE.maxX-SITE.minX,sd=SITE.maxZ-SITE.minZ,sx=(SITE.minX+SITE.maxX)/2,sz=(SITE.minZ+SITE.maxZ)/2;
const site=mesh(new THREE.PlaneGeometry(sw,sd),new THREE.MeshStandardMaterial({color:PALETTE.ember,transparent:true,opacity:.16,depthWrite:false}),sx,.02,sz,false);
site.rotation.x=-Math.PI/2;
const postGeo=new THREE.BoxGeometry(.18,1,.18),postMat=new THREE.MeshStandardMaterial({color:PALETTE.ember,emissive:PALETTE.ember,emissiveIntensity:.6});
for(const a of [-1,1])for(const b of [-1,1])mesh(postGeo,postMat,sx+a*sw/2,.5,sz+b*sd/2);
const barrelGeo=new THREE.CylinderGeometry(.45,.45,1.1,12);
for(const [x,z] of [[-19,-2],[-19,8],[19,-9],[12,13],[-6,-16],[7,16]])shootables.push(mesh(barrelGeo,materials.steel,x,.55,z));
for(const [x,z,w,h] of [[-26,-24,6,14],[24,-26,8,18],[28,10,6,12],[-28,14,7,10],[0,-30,10,20]]){
const t=mesh(new THREE.BoxGeometry(w,h,w),materials.steel,x,h/2,z);t.castShadow=false;
const tip=mesh(new THREE.BoxGeometry(.5,.5,.5),postMat,x,h+.4,z,false);
}
for(const [x,z] of [[-24,-28],[26,-30]]){
const c=mesh(new THREE.CylinderGeometry(1.1,1.4,16,10),materials.concrete,x,8,z);c.castShadow=false;
mesh(new THREE.BoxGeometry(.4,.4,.4),postMat,x,16.3,z,false);
}
const beamGeo=new THREE.BoxGeometry(30,.4,.6);
for(const z of [2,-6])mesh(beamGeo,materials.steel,0,4.6,z);
return {colliders,shootables};
}