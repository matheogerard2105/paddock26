// mesure, pour chaque circuit, la perte au tour pour 1 % d'adhérence pneu en moins
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'), e={team:tm,driver:tm.drivers[0]};
const out={};
for(const c of CIRCUITS){ const T=SIM.buildTrack(c); const a=SIM.hotLap(T,e,0).t, b=SIM.hotLap(T,e,-0.02).t; out[c.id]=+((b-a)/2).toFixed(4); console.log(c.id,out[c.id]); }
fs.writeFileSync(__dirname+'/../src/tyre_sens.json',JSON.stringify(out));
