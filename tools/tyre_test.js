// rythme par composé et perte de rythme avec l'usure sur un tour lancé seul
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const e={team:TEAMS_BASE[3],driver:TEAMS_BASE[3].drivers[0]};
for(const id of process.argv.slice(2)){
 const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id)); const out=[];
 for(const [ty,w] of [['S',0],['M',0],['H',0],['S',0.5],['S',0.9],['H',0.5]]){
   const R=SIM.createRace(T,[e],{laps:40}); const c=R.cars[0]; c.tyre=ty; c.wear=w; c.warm=0; c.errRate=0;
   R.phase='race'; R.startT=0; c.reaction=0; c.dist=-900; c.s=SIM.mod(c.dist,T.L); c.v=SIM.at(T,T.env,c.s)*0.9; c.d=SIM.at(T,T.alpha,c.s);
   let t0=null; while(R.t<400){ const w0=c.wear; SIM.step(R,1/60); c.wear=w; c.warm=0; if(c.lapsDone===0&&t0===null)t0=R.t; if(c.lapsDone>=1){out.push(ty+(w?'@'+w:'')+' '+SIM.fmtLap(R.t-t0)+(R.t-t0>T.L/50?' ['+R.events.map(x=>x.msg).join(',')+']':''));break;} }
 }
 console.log(id, JSON.stringify(SIM.tyreProfile(T.circ)).slice(0,60), '|', out.join('  '));
}
