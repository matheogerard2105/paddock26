const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id==='bh-2002'));
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
const R=SIM.createTimeTrial(T,e,{assist:true,level:'pro'}); const me=R.cars[0];
while(R.t<330){ const env=SIM.at(T,T.env,me.s+25)*0.95; R.input.thr=me.v<env?1:0; R.input.brk=me.v>env+3?1:0;
 R.input.steer=Math.max(-1,Math.min(1,-(SIM.at(T,T.alpha,me.s+10)-me.d)*0.35)); SIM.step(R,1/60); }
console.log(R.tt.laps.map(l=>SIM.fmtLap(l.time)+(l.valid?'':' ANNULÉ')+' samples '+(l.samples?l.samples.length:0)).join(' | '));
const q=SIM.qualifying(T,TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d}))),0,1,'');
const g=SIM.ghostLap(T,q[0].entry,q[0].gn,0,q[0].best); console.log('P1',SIM.fmtLap(q[0].best),'ghost samples',g.samples.length,'last',g.samples[g.samples.length-1]);
