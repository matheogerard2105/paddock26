const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id==='bh-2002'));
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
for(const lvl of ['debutant','amateur','pro','legende']){
 const q=SIM.qualifying(T,entries,0,SIM.LEVELS[lvl].pace,entries[0].driver.name);
 const R=SIM.createQualiRun(T,entries[0],{assist:true,weather:'dry',level:lvl}); const me=R.cars[0];
 while(!R.over&&R.t<400){ const env=SIM.at(T,T.env,me.s+25)*0.95, al=SIM.at(T,T.alpha,me.s+8);
  R.input.thr=me.v<env?1:0; R.input.brk=me.v>env+3?1:0; R.input.steer=Math.max(-1,Math.min(1,-(SIM.at(T,T.alpha,me.s+10)-me.d)*0.35)); SIM.step(R,1/60); }
 console.log(lvl,'AI pole',SIM.fmtLap(q.find(r=>r.entry.driver.name!==entries[0].driver.name).best),'robot',R.qualiRun.time?SIM.fmtLap(R.qualiRun.time):'—',R.qualiRun.invalid?'ANNULÉ '+R.qualiRun.why:'');
}
