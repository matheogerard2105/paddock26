const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id==='bh-2002'));
const ent=TEAMS_BASE.slice(0,2).flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const R=SIM.createRace(T,ent,{laps:5,human:3,assist:true,level:'pro'});
const me=R.cars[3]; let minPos=9;
while(R.t<9) { R.input.thr=1; SIM.step(R,1/60); }
R.flag='vsc'; R.vscEndT=1e9; R.cars.forEach(c=>c.nb=c.nb); const start=me.pos;
while(R.t<200){ R.input.thr=1; R.input.brk=0; R.input.steer=0; SIM.step(R,1/60); minPos=Math.min(minPos,me.pos); }
console.log(R.events.filter(e=>e.cars.includes(3)).map(e=>e.t.toFixed(0)+' '+e.msg).join(' | ')); console.log('position au déploiement',start,'meilleure position sous VSC',minPos, 'state',me.state);
