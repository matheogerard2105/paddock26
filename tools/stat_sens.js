// secondes au tour gagnées par point de stat (ligne_droite, virage, pneus) et par point de skill
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
for(const id of process.argv.slice(2)){ const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
  const t0=TEAMS_BASE[4], d0=t0.drivers[0];
  const lap=(tm,dr)=>SIM.hotLap(T,{team:tm,driver:dr},0).t, base=lap(t0,d0);
  const out=['ligne_droite','virage','pneus'].map(k=>k+' '+((base-lap(Object.assign({},t0,{[k]:+t0[k]+5}),d0))/5).toFixed(3));
  out.push('skill '+((base-lap(t0,Object.assign({},d0,{skill:d0.skill+5})))/5).toFixed(3));
  console.log(id,SIM.fmtLap(base),out.join('  '),'s/pt');
}
