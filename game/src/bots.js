import * as THREE from 'three';
import {WAYPOINTS,EDGES,SITE} from './config.js';
import {stepActor} from './actors.js';

const n=WAYPOINTS.length, adj=Array.from({length:n},()=>[]);
for(const e of EDGES){const a=e[0],b=e[1];adj[a].push(b);adj[b].push(a)}
const v=(p,i=0)=>Array.isArray(p)?p[i]||0:p?.[['x','y','z'][i]]||0;
const wp=i=>WAYPOINTS[i], pos=p=>new THREE.Vector3(v(p),v(p,1),v(p,2));
const site=new THREE.Vector3(0,0,-8.5);
const laneW=[1,3,6,9,23],laneM=[22,4,7,10],laneE=[2,5,8,11,24];
const entries=[12,13], holdA=[new THREE.Vector3(-8,0,-9.8),new THREE.Vector3(8,0,-9.8),new THREE.Vector3(-4,0,-5)];
const holdR=[new THREE.Vector3(-9,0,-6),new THREE.Vector3(9,0,-6)];
const holdM=new THREE.Vector3(0,0,1),entryH=[new THREE.Vector3(-4,0,-5),new THREE.Vector3(4,0,-5),new THREE.Vector3(0,0,-4)];
const q=new THREE.Vector3(),d=new THREE.Vector3();

export function nearestWp(p){
  let k=0,b=Infinity;
  for(let i=0;i<n;i++){const x=v(wp(i))-v(p),y=v(wp(i),1)-v(p,1),z=v(wp(i),2)-v(p,2),s=x*x+y*y+z*z;if(s<b)b=s,k=i}
  return k
}
export function findPath(a,b){
  if(a===b)return[a];
  const g=Array(n).fill(Infinity),f=Array(n).fill(Infinity),prev=Array(n).fill(-1),open=[a],used=Array(n).fill(false);
  g[a]=0;f[a]=dist(wp(a),wp(b));
  while(open.length){
    let oi=0;for(let i=1;i<open.length;i++)if(f[open[i]]<f[open[oi]])oi=i;
    const x=open.splice(oi,1)[0];if(x===b){const r=[];for(let i=b;i>=0;i=prev[i]){r.push(i);if(i===a)break}return r.reverse()}used[x]=true;
    for(const y of adj[x])if(!used[y]){const ng=g[x]+dist(wp(x),wp(y));if(ng<g[y]){prev[y]=x;g[y]=ng;f[y]=ng+dist(wp(y),wp(b));if(!open.includes(y))open.push(y)}}
  }
  return[a]
}
function dist(a,b){const x=v(a)-v(b),y=v(a,1)-v(b,1),z=v(a,2)-v(b,2);return Math.hypot(x,y,z)}
function yawTo(a,p){return Math.atan2(-(v(p)-v(a)), -(v(p,2)-v(a,2)))}
function ang(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a))}
function face(a,y,t=.18){a.yaw+=ang(a.yaw,y)*Math.min(1,t)}
function dead(a){return !a.alive||a.hp<=0}
function side(a){return a.team??(a.role?.startsWith('a')?'atk':a.role?.startsWith('d')?'def':a.isPlayer?'atk':null)}
function enemy(a,b){const x=side(a),y=side(b);return b!==a&&!dead(b)&&(x&&y?x!==y:b.isPlayer||b.player||b.role!==a.role)}
function pathTo(b,p){
  const k=nearestWp(p);
  if(b.pk!==k){b.path=findPath(nearestWp(b.actor.pos),k);b.pi=0;b.pk=k}
}
function at(a,p,r=1.5){return dist(a.pos,p)<r}
function chooseHold(b,p){b.holdPos=p;pathTo(b,p)}
function movePath(b,ctx,dt){
  const a=b.actor;if(!b.path.length)return;
  if(b._px===undefined){b._px=a.pos.x;b._pz=a.pos.z;b._st=0}
  const moved=Math.hypot(a.pos.x-b._px,a.pos.z-b._pz);
  if(moved<0.05){b._st+=dt;if(b._st>2){b.pi++;b._st=0}}else{b._st=0;b._px=a.pos.x;b._pz=a.pos.z}
  while(b.pi<b.path.length&&dist(a.pos,wp(b.path[b.pi]))<.7)b.pi++;
  if(b.pi>=b.path.length)return;
  const p=wp(b.path[b.pi]);q.set(v(p)-v(a.pos),0,v(p,2)-v(a.pos,2));const l=q.length();
  if(l){q.multiplyScalar(1/l);stepActor(a,q.x,q.z,dt,ctx.colliders,false);face(a,Math.atan2(-q.x,-q.z),.22)}
}
export function createBrain(actor,role){
  return{actor,role,state:'advance',path:[],pi:0,thinkAt:0,reactAt:0,burstUntil:0,pauseUntil:0,enemy:null,lastSeen:new THREE.Vector3,hasSeen:false,holdPos:null,lane:0,pk:-1,seenAt:0,noiseAt:0}
}
export function stepBots(bs,dt,now,ctx){
  for(let bi=0;bi<bs.length;bi++){
    const b=bs[bi],a=b.actor;if(dead(a))continue;
    if(!b.thinkAt)b.thinkAt=now+bi*35;
    let e=b.enemy;
    if(now>=b.thinkAt){
      b.thinkAt=now+150;
      let best=null,bd=40;
      for(const x of ctx.actors){if(!enemy(a,x))continue;const z=dist(a.pos,x.pos);if(z>=bd||!ctx.canShoot(a,x))continue;const yy=yawTo(a,x.pos);if(z>=4&&Math.abs(ang(a.yaw,yy))>Math.PI*100/180)continue;best=x;bd=z}
      if(best){if(!b.enemy)b.reactAt=now+280+ctx.rng()*250;b.enemy=best;b.lastSeen.copy(best.pos);b.hasSeen=true;b.seenAt=now}
      else if(b.enemy&&now-b.seenAt>1200)b.enemy=null;
      e=b.enemy;
      if(e)b.state='engage';
      else if(now-b.seenAt<1200&&b.hasSeen){b.state='investigate';pathTo(b,b.lastSeen)}
      else if(ctx.noise&&now-ctx.noise.at<2500&&dist(a.pos,ctx.noise.pos)<18){
        if(!b.noiseAt||now-b.noiseAt>2000){b.noiseAt=now;if(ctx.rng()<.4){b.state='investigate';pathTo(b,ctx.noise.pos)}}
      }
      if(!e&&!b.enemy){
        const atk=b.role==='carrier'||b.role==='entry'||b.role==='support';
        if(ctx.phase==='planted'&&ctx.bombPos){
          if(atk){chooseHold(b,ctx.bombPos)}
          else pathTo(b,ctx.bombPos);
        }else if(atk){
          if(b.role==='carrier'){
            pathTo(b,wp(14));
            if(at(a,site,3.2)&&ctx.phase==='live')ctx.tryPlant(a);
          }else if(b.role==='entry'){chooseHold(b,entryH[b.lane%3])}
          else chooseHold(b,entryH[2]);
        }else if(b.role==='anchor')chooseHold(b,holdA[b.lane%holdA.length]);
        else if(b.role==='rotate'){chooseHold(b,ctx.phase==='planted'&&ctx.bombPos?ctx.bombPos:holdR[b.lane%2])}
        else chooseHold(b,holdM);
      }
    }
    if(ctx.phase==='buy'){stepActor(a,0,0,dt,ctx.colliders,false);continue}
    e=b.enemy;
    if(e&&now>=b.reactAt){
      b.state='engage';const z=dist(a.pos,e.pos);face(a,yawTo(a,e.pos),.3);
      a.crouch=z>12&&ctx.rng()<.3;
      let wx=0,wz=0;if(ctx.rng()<.16){const s=ctx.rng()<.5?-1:1;wx=s*.16}
      stepActor(a,wx,wz,dt,ctx.colliders,false);
      if(now>=b.pauseUntil){if(now>=b.burstUntil){b.burstUntil=now+400+ctx.rng()*500;b.pauseUntil=b.burstUntil+300+ctx.rng()*400}else ctx.shoot(a,e)}
    }else{
      a.crouch=false;
      if(ctx.phase==='planted'&&!side(a)?.startsWith('a')&&ctx.bombPos&&at(a,ctx.bombPos,1.6))ctx.tryDefuse(a);
      movePath(b,ctx,dt);
    }
  }
}