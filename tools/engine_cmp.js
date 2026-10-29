// compare hybride vs 100 % thermique (hotLap, ligne de qualif) : node tools/engine_cmp.js [ids] [P_THERM kW,...]
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const ids=(process.argv[2]||'at-1969,mc-1929,it-1922,be-1925,sg-2008').split(','), Ps=(process.argv[3]||'500,560,620').split(',').map(Number);
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'), e={team:tm,driver:tm.drivers[0]};
for(const id of ids){ const c=CIRCUITS.find(x=>x.id===id); const T=SIM.buildTrack({...c,useLine:true});
  SIM.setEngine('hybrid'); const h=SIM.hotLap(T,e,0,undefined,'trace'); const out=[id,'hyb',SIM.fmtLap(h.t),Math.round(h.vmax*3.6)+'km/h'];
  for(const p of Ps){ SIM.setEngine('ice'); SIM.setPTherm(p*1e3); const r=SIM.hotLap(T,e,0); out.push(p+'kW',SIM.fmtLap(r.t),(r.t-h.t>=0?'+':'')+(r.t-h.t).toFixed(2),Math.round(r.vmax*3.6)+'km/h'); }
  console.log(out.join(' ')); }
