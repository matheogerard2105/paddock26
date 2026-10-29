const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id==='bh-2002'));
const teams=JSON.parse(JSON.stringify(TEAMS_BASE)); for(const t of teams) for(const k of ['ligne_droite','virage','pneus','depart']) t[k]=50;
const R=SIM.createRace(T,teams.flatMap(t=>t.drivers.map(d=>({team:t,driver:d}))),{laps:1});
while(!R.over&&R.t<600) SIM.step(R,1/60);
console.log('over',R.over,'t',R.t.toFixed(0),'winner',R.cars[R.finishOrder[0]].driver.name,'pits',R.events.filter(e=>e.type==='pit').length,'best',SIM.fmtLap(Math.min(...R.cars.map(c=>c.bestLap||999))));
