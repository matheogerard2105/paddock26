// Stratégies réelles des IA sur une course : relais (pneu, tours, usure en fin de relais) de chaque voiture.
// node tools/strat_ai.js gb-1948 10 [n courses]
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require(process.env.SIM||'../src/sim.js');
const [id,laps='10',n='1',quiet]=process.argv.slice(2);
const c=CIRCUITS.find(x=>x.id===id); const T=SIM.buildTrack(c);
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const q=SIM.qualifying(T,entries);
let agg={stops:0,wearEnd:0,n:0,stintWear:0,ns:0};
for(let r=0;r<+n;r++){
  const R=SIM.createRace(T,q.map(r=>r.entry),{laps:+laps});
  const log=R.cars.map(cc=>[{t:cc.tyre,l0:0}]), last=R.cars.map(cc=>({tyre:cc.tyre,wear:0}));
  while(!R.over && R.t<laps*200){ SIM.step(R,1/30);
    R.cars.forEach((cc,i)=>{ const L=log[i]; if(cc.tyre!==last[i].tyre||cc.wear<last[i].wear-0.05){ L[L.length-1].w=last[i].wear; L[L.length-1].l1=cc.lapsDone; L.push({t:cc.tyre,l0:cc.lapsDone}); } last[i]={tyre:cc.tyre,wear:cc.wear}; }); }
  for(const cc of R.ranked){ const L=log[cc.id]; L[L.length-1].w=cc.wear; L[L.length-1].l1=cc.finLaps??cc.lapsDone;
    if(cc.state!=='out'){agg.stops+=cc.stops;agg.wearEnd+=cc.wear;agg.n++; for(const s of L){agg.stintWear+=s.w;agg.ns++;}}
    if(!quiet) console.log(String(cc.pos).padStart(2),cc.code,'grid',String(cc.gridPos).padStart(2),'gap',cc.gap==null?'OUT':cc.gap.toFixed(1).padStart(6),(cc.stratName||'').padEnd(24),L.map(s=>`${s.t}${s.l0}-${s.l1}(${Math.round(s.w*100)}%)`).join(' → '));
  }
}
console.log(`moyenne : ${(agg.stops/agg.n).toFixed(2)} arrêts, usure à l'arrivée ${(agg.wearEnd/agg.n*100).toFixed(0)} %, usure en fin de relais ${(agg.stintWear/agg.ns*100).toFixed(0)} %`);
