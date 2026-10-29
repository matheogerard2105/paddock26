const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
for(const id of process.argv.slice(2)){ const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
 const R=SIM.createRace(T,TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d}))),{laps:8});
 const out=[]; let lap=-1, clip=0, n=0;
 while(!R.over&&R.t<2000){ SIM.step(R,1/60); const c=R.cars[0]; if(c.clip)clip++; n++; if(c.lapsDone!==lap){lap=c.lapsDone; out.push(`L${lap}:${(c.soc/1e6).toFixed(1)}MJ lt ${SIM.fmtLap(c.lastLap)} clip ${(clip/n*100).toFixed(0)}%`); clip=0;n=0;} }
 console.log(id,out.join(' | ')); }
