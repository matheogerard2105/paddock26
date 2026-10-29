const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
for(const c of CIRCUITS){ const T=SIM.buildTrack(c); const r=SIM.hotLap(T,e,0);
 const i=SIM.idxOf(T,r.maxOverS); console.log(c.id.padEnd(8),'t',r.t.toFixed(2),'maxOver',r.maxOver.toFixed(2),'at s',r.maxOverS.toFixed(0),'alpha',T.alpha[i].toFixed(2),'lim',T.lim.toFixed(2),'kRL',T.kRL[i].toFixed(4)); }
