// Pilote « robot » branché sur les commandes humaines pour vérifier que la voiture est conduisible.
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id='bh-2002',assist='1']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
const R=SIM.createRace(T,[{team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]}],{laps:3,human:0,assist:assist==='1'?true:assist==='semi'?'semi':false,level:process.argv[4]||'pro'});
const me=R.cars[0]; let off=0,n=0;
while(!R.over&&R.t<600){
  const env=SIM.at(T,T.env,me.s+25)*0.93, al=SIM.at(T,T.alpha,me.s+8);
  R.input.thr = me.v<env?1:0; R.input.brk = me.v>env+3?1:0;
  const err=al-me.d; R.input.steer = Math.max(-1,Math.min(1,-(err*0.5 + (assist==='1'?0:assist==='semi'?-me.vd*0.15:-me.vd*0.3))));
  SIM.step(R,1/60); n++; if(me.offTrack) off++;
}
console.log(id,'assist',assist,'state',me.state,'laps',me.lapsDone,'best',SIM.fmtLap(me.bestLap),'pos',me.pos,'offtrack%',(off/n*100).toFixed(1),me.retiredWhy||'');
