const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
for(const id of process.argv.slice(2)){ const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
 const out=[0,0.4,0.9].map(w=>{const r=SIM.hotLap(T,e,0,undefined,false,w); return w+':'+SIM.fmtLap(r.t)+(r.ev&&r.ev.length?' '+r.ev.map(x=>x.msg).join(','):'')+' over'+(r.maxOver||0).toFixed(1)}); console.log(id,out.join(' | ')); }
