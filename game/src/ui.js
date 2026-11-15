import {WEAPONS,GRENADES} from './config.js';

export function createUi({onBuy=()=>{},onPlay=()=>{}}={}){
 const $=id=>document.getElementById(id),n=(e,v)=>{if(e&&e.textContent!==String(v))e.textContent=v};
 const hp=$('hp'),mag=$('ammo-mag'),res=$('ammo-reserve'),money=$('money'),timer=$('timer'),
 round=$('round-label'),sa=$('score-atk'),sd=$('score-def'),team=$('team-label'),
 hit=$('hitmarker'),cross=$('crosshair'),feed=$('killfeed'),banner=$('banner'),
 vignette=$('damage-vignette'),flash=$('flash-overlay'),cw=$('channel-wrap'),
 cb=$('channel-bar'),cl=$('channel-label'),buy=$('buy-menu'),items=$('buy-items'),
 bm=$('buy-money'),close=$('buy-close-hint'),overlay=$('overlay'),
 ot=$('overlay-title'),oc=$('overlay-copy'),play=$('play'),scope=$('scope-overlay');
 let bt,bo,scopeOn=false,lastBuy;
 const text=(e,v)=>{if(e&&e.textContent!==String(v))e.textContent=v};
 function setHealth(v){text(hp,v)}
 function setAmmo(a,r,w){text(mag,a);text(res,r);if(mag)mag.dataset.weapon=w||''}
 function setMoney(v){text(money,v);if(bm)text(bm,v)}
 function setTimer(v,u){text(timer,v);timer&&timer.classList.toggle('urgent',!!u)}
 function setScore(r,a,d,p){text(round,r&&`ROUND ${r}`||'');text(sa,a);text(sd,d);if(team)text(team,p||'')}
 function bannerShow(t,s='',ms=2500){
  clearTimeout(bt);banner.innerHTML='';
  const x=document.createElement('span');x.textContent=t;banner.append(x);
  if(s){const z=document.createElement('small');z.textContent=s;banner.append(z)}
  banner.style.opacity=1;
  bt=setTimeout(()=>{banner.style.opacity=0},ms)
 }
 function killfeed(t){
  const x=document.createElement('div');x.textContent=t;feed.append(x);
  while(feed.children.length>5)feed.firstElementChild.remove();
  setTimeout(()=>{x.classList.add('fade');setTimeout(()=>x.remove(),500)},4500)
 }
 function hitMarker(k){hit.classList.remove('show','kill');void hit.offsetWidth;hit.classList.add('show');if(k)hit.classList.add('kill')}
 function damageFlash(){vignette.classList.remove('pulse');void vignette.offsetWidth;vignette.classList.add('pulse')}
 function setFlash(a){flash.style.opacity=a}
 function setChannel(f,l=''){if(f<0){cw.hidden=true;return}cw.hidden=false;cb.style.width=Math.max(0,Math.min(1,f))*100+'%';text(cl,l)}
 function label(k,c){return c.name||c.label||c.title||k}
 function price(c){return c.price??c.cost??0}
 function showBuy(m,owned=new Set(),loadout){
  lastBuy=[m,owned,loadout];buy.hidden=false;setMoney(m);items.replaceChildren();
  const all=[...['pistol','smg','shotgun','rifle','sniper'].map(k=>[k,WEAPONS[k]]),...['flash','frag'].map(k=>[k,GRENADES[k]])];
  all.forEach(([k,c])=>{
   if(!c)return;
   const b=document.createElement('button'),p=price(c),has=owned.has(k);
   b.className='buy-item';b.disabled=has||m<p;
   const name=label(k,c);b.textContent=`${name}  $${p}`;
   if(has)b.classList.add('owned');
   b.onclick=()=>onBuy(k);
   items.append(b)
  });
  if(close)close.textContent='ESC TO CLOSE'
 }
 function hideBuy(){buy.hidden=true}
 const modes={
  start:['BREACHLINE','Enter the fight'],pause:['PAUSED','The match is paused'],roundwin:['ROUND WON','Your team secured the round'],roundlose:['ROUND LOST','The enemy secured the round'],matchwin:['MATCH WON','Victory'],matchlose:['MATCH LOST','Defeat']
 };
 function showOverlay(mode,d={}){
  const q=modes[mode]||[d.title||mode,d.copy||''];
  overlay.hidden=false;text(ot,d.title||q[0]);text(oc,d.copy||q[1]);
  play.hidden=!['start','pause','matchwin','matchlose'].includes(mode);play.onclick=onPlay
 }
 function hideOverlay(){overlay.hidden=true}
 function setScope(v){scopeOn=!!v;scope.hidden=!scopeOn;scope.style.background=scopeOn?'radial-gradient(circle,transparent 0 34%,#000 35%)':''}
 function crosshairSpread(v){cross.style.setProperty('--spread',v+'px')}
 return {setHealth,setAmmo,setMoney,setTimer,setScore,banner:bannerShow,killfeed,hitMarker,damageFlash,setFlash,setChannel,showBuy,hideBuy,showOverlay,hideOverlay,setScope,crosshairSpread}
}