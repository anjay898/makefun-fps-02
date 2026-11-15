import{TIMING,ECONOMY,SITE}from'./config.js';
export const createMatch=()=>({round:1,score:{atk:0,def:0},phase:'buy',phaseEnd:0,bombMode:'carried',carrier:null,bombPos:null,bombEnd:0,channel:null,matchOver:false,lastReason:''});
export const inSite=a=>a.pos.x>=SITE.minX&&a.pos.x<=SITE.maxX&&a.pos.z>=SITE.minZ&&a.pos.z<=SITE.maxZ;
export const aliveCount=(actors,t)=>actors.filter(a=>a.team===t&&a.alive).length;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),copy=p=>({x:p.x,z:p.z});
export function beginRound(M,actors,now,rng){
const atk=actors.filter(a=>a.team==='atk');
Object.assign(M,{phase:'buy',phaseEnd:now+TIMING.buyMs,bombMode:'carried',bombPos:null,channel:null,carrier:atk.length?atk[Math.floor(rng()*atk.length)]:null});
}
export function startChannel(M,a,kind,now){
if(kind==='plant'){
if(M.phase!=='live'||!((M.bombMode==='carried'&&M.carrier===a)||M.bombMode==='dropped')||!inSite(a))return false;
if(M.bombMode==='dropped'){M.carrier=a;M.bombMode='carried';}
M.channel={actor:a,kind,endAt:now+TIMING.plantMs};
return true;
}
if(kind==='defuse'&&M.bombMode==='planted'&&a.team==='def'&&M.bombPos&&dist(a.pos,M.bombPos)<2){
M.channel={actor:a,kind,endAt:now+TIMING.defuseMs};
return true;
}
return false;
}
export function cancelChannel(M,a){if(M.channel?.actor===a)M.channel=null;}
function endRound(M,actors,now,w,reason){
M.score[w]++;M.lastReason=reason;M.phase='over';M.phaseEnd=now+6000;M.channel=null;
for(const a of actors)a.money=Math.min(ECONOMY.cap,a.money+(a.team===w?ECONOMY.win:ECONOMY.loss));
}
export function updateMatch(M,actors,now){
if(M.matchOver)return null;
if(M.phase==='buy'&&now>=M.phaseEnd){
M.phase='live';M.phaseEnd=now+TIMING.roundMs;return'live';
}
if(M.phase==='over'&&now>=M.phaseEnd){
if(M.score.atk>=TIMING.winRounds||M.score.def>=TIMING.winRounds){M.matchOver=true;return'matchover';}
M.round++;return'nextround';
}
if(M.phase!=='live')return null;
const c=M.channel;
if(c){
if(!c.actor.alive)M.channel=null;
else if(now>=c.endAt){
if(c.kind==='plant'){
M.bombMode='planted';M.bombPos=copy(c.actor.pos);M.bombEnd=now+TIMING.bombMs;
for(const a of actors)if(a.team==='atk')a.money=Math.min(ECONOMY.cap,a.money+ECONOMY.plant);
M.channel=null;return'planted';
}
if(c.kind==='defuse'){endRound(M,actors,now,'def','defuse');return'roundend';}
}
}
if(M.bombMode==='carried'&&M.carrier&&!M.carrier.alive){
M.bombMode='dropped';M.bombPos=copy(M.carrier.pos);return'dropped';
}
if(M.bombMode==='dropped'&&M.bombPos){
const a=actors.find(a=>a.alive&&a.team==='atk'&&dist(a.pos,M.bombPos)<1.2);
if(a){M.carrier=a;M.bombMode='carried';return'pickup';}
}
let w,reason;
if(M.bombMode==='planted'){
if(now>=M.bombEnd){w='atk';reason='detonate';}
else if(!aliveCount(actors,'def')){w='atk';reason='elim';}
}else{
if(!aliveCount(actors,'def')){w='atk';reason='elim';}
else if(!aliveCount(actors,'atk')){w='def';reason='elim';}
else if(now>=M.phaseEnd){w='def';reason='time';}
}
if(w){endRound(M,actors,now,w,reason);return'roundend';}
return null;
}