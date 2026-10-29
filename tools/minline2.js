// Affinage local des trajectoires de qualif : pour chaque portion (~120 m) on essaie la ligne de courbure
// minimale ou un mélange, raccordés en douceur, et on garde ce qui améliore un vrai tour simulé.
// usage : node tools/minline2.js [ids]
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m); const {CIRCUITS,TEAMS_BASE}=m.exports;
globalThis.SIM_TUNE={}; const SIM=require('../src/sim.js');
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
const ids=process.argv[2]?process.argv[2].split(','):CIRCUITS.map(c=>c.id);
let txt=fs.readFileSync(CF,'utf8');
for(const id of ids){
  const c=CIRCUITS.find(x=>x.id===id); if(!c.line) { console.log(c.name,'pas de ligne optimisée'); continue; }
  SIM_TUNE.NOLINE=1; const T0=SIM.buildTrack({...c,useLine:true}); SIM_TUNE.NOLINE=0;
  const N=T0.N, mc=Float64Array.from(T0.alpha);
  const T1=SIM.buildTrack({...c,useLine:true}); let cur=Float64Array.from(T1.alpha);
  const lap=al=>{ const enc=Array.from({length:Math.ceil(N/2)},(_,i)=>Math.round(al[(2*i)%N]*10)); const h=SIM.hotLap(SIM.buildTrack({...c,line:enc,useLine:true}),e,0); return h.maxOver<0?h.t:999; };
  const enc=al=>Array.from({length:Math.ceil(N/2)},(_,i)=>Math.round(al[(2*i)%N]*10));
  let best=lap(cur); const t0=best; const W=Math.round(120/T0.ds), R=Math.round(30/T0.ds);
  for(let pass=0;pass<2;pass++){
    for(let st=0; st<N; st+=Math.round(W/2)){
      for(const b of [1,0.5]){
        const al=Float64Array.from(cur);
        for(let u=-R;u<W+R;u++){ const i=(st+u+N)%N; let w=1; if(u<0) w=0.5*(1+Math.cos(Math.PI*u/R)); else if(u>=W) w=0.5*(1+Math.cos(Math.PI*(u-W)/R)); al[i]=cur[i]+w*b*(mc[i]-cur[i]); }
        const t=lap(al); if(t<best-0.005){ best=t; cur=al; }
      }
    }
  }
  txt=txt.replace(new RegExp('(\\{"id":"'+id+'",)("line":\\[[-0-9,]*\\],)?'),(_,a)=>a+'"line":'+JSON.stringify(enc(cur))+',');
  fs.writeFileSync(CF,txt);
  console.log(c.name.padEnd(16),SIM.fmtLap(t0),'→',SIM.fmtLap(best));
}
