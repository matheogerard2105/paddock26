// Trajectoires « temps minimal » : optimise la ligne de chaque circuit, garde le meilleur mélange
// (ligne de courbure minimale ↔ ligne optimisée) d'après un vrai tour simulé, et l'écrit dans src/circuits.js
// usage : node tools/minline.js [ids séparés par des virgules]
const fs=require('fs');
const CF=__dirname+'/../src/circuits.js';
const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports;
globalThis.SIM_TUNE={NOLINE:1}; const SIM=require('../src/sim.js');
const ids=process.argv[2]?process.argv[2].split(','):CIRCUITS.map(c=>c.id);
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
let txt=fs.readFileSync(CF,'utf8');
for(const id of ids){
  const c=CIRCUITS.find(x=>x.id===id); SIM_TUNE.NOLINE=1; const T=SIM.buildTrack(c);
  const base=Float64Array.from(T.alpha), t0=SIM.hotLap(T,e,0).t, opt=SIM.optimizeLine(T);
  let best=null, bt=t0;
  for(const b of [0.25,0.5,0.75,1]){
    const enc=Array.from({length:Math.ceil(T.N/2)},(_,i)=>Math.round((base[(2*i)%T.N]+b*(opt[(2*i)%T.N]-base[(2*i)%T.N]))*10));
    SIM_TUNE.NOLINE=0; const h=SIM.hotLap(SIM.buildTrack(Object.assign({},c,{line:enc,useLine:true})),e,0);
    if(h.t<bt-0.02 && h.maxOver<0){ bt=h.t; best={b,enc}; }
  }
  txt=txt.replace(new RegExp('(\\{"id":"'+id+'",)("line":\\[[-0-9,]*\\],)?'), (_,a)=>a+(best?'"line":'+JSON.stringify(best.enc)+',':''));
  console.log(c.name.padEnd(16),SIM.fmtLap(t0),'→',SIM.fmtLap(bt),best?`(mélange ${best.b})`:'(ligne de courbure minimale conservée)');
}
fs.writeFileSync(CF,txt);
