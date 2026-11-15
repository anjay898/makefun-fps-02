export const PALETTE = {canvas:'#171C26',steel:'#343E48',concrete:'#887765',ember:'#E78B45',warden:'#65B8C8',ink:'#E8DFC9'};

export const WEAPONS = {
  knife:{dmg:45,rpm:90,mag:999,price:0,range:1.6,auto:false,reloadMs:0,recoil:0,spread:0,headMult:1},
  pistol:{name:'P9 Sidearm',dmg:25,headMult:4,rpm:360,mag:12,reserve:60,price:250,auto:false,spread:0.006,reloadMs:1100,recoil:0.012},
  smg:{name:'Raptor',dmg:21,headMult:3,rpm:780,mag:30,reserve:90,price:1200,auto:true,spread:0.016,falloff:0.012,reloadMs:1900,recoil:0.008},
  rifle:{name:'Vesper Longshot',dmg:35,headMult:3,rpm:600,mag:24,reserve:72,price:2600,auto:true,spread:0.009,reloadMs:2100,recoil:0.014},
  shotgun:{name:'Kiln',dmg:10,pellets:8,headMult:1.5,rpm:80,mag:6,reserve:24,price:1600,spread:0.05,falloff:0.02,reloadMs:2600,recoil:0.03},
  sniper:{name:'Farwatch',dmg:85,headMult:2,rpm:45,mag:5,reserve:20,price:4200,spread:0.001,reloadMs:2800,recoil:0.04,zoom:true}
};

export const GRENADES = {
  flash:{name:'Flash Charge',price:200},
  frag:{name:'Frag Charge',price:300,dmg:90,radius:5}
};
export const ECONOMY = {start:800,kill:300,win:3000,loss:1900,plant:300,cap:9000};
export const TIMING = {buyMs:12000,roundMs:100000,bombMs:35000,plantMs:3000,defuseMs:6000,winRounds:7};
export const SITE = {minX:-5,maxX:5,minZ:-12,maxZ:-5};
export const SPAWN_ATK = [{x:0,z:15},{x:-2,z:15},{x:2,z:15},{x:-4,z:16},{x:4,z:16}];
export const SPAWN_DEF = [{x:0,z:-15},{x:-2,z:-15},{x:2,z:-15},{x:-4,z:-16},{x:4,z:-16}];

export const BOXES = [
  [-20,0,1,37,3,'concrete'],[20,0,1,37,3,'concrete'],
  [0,-18,40,1,3,'concrete'],[0,18,40,1,3,'concrete'],
  [0,11,6,2,1.1,'steel'],[-15,11,4,3,1.1,'ember'],[15,11,4,3,1.1,'ember'],
  [-9,2,2,12,3,'concrete'],[9,2,2,12,3,'concrete'],
  [-17,3,3,4,1.1,'steel'],[-14,-5,4,3,1.6,'steel'],
  [-3,5,3,2,1.1,'ember'],[3,0,4,4,2.2,'concrete'],
  [16,3,4,4,2.2,'concrete'],[14,-5,5,2,1.1,'steel'],
  [0,-8,3,3,1.6,'warden'],[-8,-12,4,3,2.2,'warden'],[9,-12,4,3,2.2,'warden'],
  [0,6,3,2,1.1,'steel'],[-4,-2,2,2,1.1,'steel'],[5,12.5,2,2,1.1,'ember'],
  [-15,-11,3,2,1.1,'warden'],[16,-11,3,2,1.1,'warden']
].map(([x,z,w,d,h,mat]) => ({x,z,w,d,h,mat}));

// Waypoints are hand-checked against BOXES: every node stands in open floor (never inside a
// collider), lane crossings pass through the divider gaps at z > 8 and z < -4, and every edge
// runs clear of the boxes or grazes a corner the axis-separated movement slides around.
export const WAYPOINTS = [
  [0,15],[-12,13],[12,13],[-15,6],[-3,8],[15,6],
  [-15,0],[0,1],[12.5,0],[-10.5,-8],[0,-4],[10.5,-7],
  [-4,-5],[4,-5],[2.8,-8],[-8,-9.8],[8,-9.8],[0,-15],
  [-6.5,9.5],[3.5,10.5],[-9,-6],[7.5,-6],[-5.5,12],[-12,-11],[12.5,-11]
].map(([x,z]) => ({x,z}));

export const EDGES = [
  [0,1],[0,2],[0,22],[1,3],[2,5],[22,4],
  [3,6],[6,9],[9,23],[5,8],[8,11],[11,24],
  [4,7],[7,10],[10,12],[10,13],[12,14],[13,14],
  [3,18],[18,4],[4,19],[19,5],
  [9,20],[20,12],[13,21],[21,11],
  [23,15],[17,16],[16,24],
  [14,17],[12,15],[13,16]
];