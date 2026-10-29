const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
for(const id of process.argv.slice(2)){ const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
 console.log(id, ['line',undefined],['center','c'],['+2',2],['-2',-2],['+4',4],['-4',-4].map?[[ 'line',undefined],['center','c'],['+2',2],['-2',-2],['+4',4],['-4',-4]].map(([n,o])=>n+':'+SIM.hotLap(T,e,0,o).t.toFixed(2)).join('  '):'');}
