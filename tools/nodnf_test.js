// Le joueur fonce dans la voiture de devant : avec noDnf il ne doit jamais abandonner ni être abîmé.
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id='mc-1929',noDnf='1',runs='4']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
let outs=0,dmg=0,contacts=0,othersOut=0,laps=0;
for(let k=0;k<+runs;k++){
  const ent=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
  const R=SIM.createRace(T,ent,{laps:3,human:10,assist:'on',level:'pro',chaos:5,noDnf:noDnf==='1'});
  const me=R.cars[10]; R.onContact=(a,b)=>{ if(a===me||b===me) contacts++; };
  while(!R.over&&R.t<600&&me.state!=='out'){
    let ahead=null,best=1e9;
    for(const o of R.cars){ if(o===me||o.state!=='run') continue; const ds=SIM.mod(o.dist-me.dist,T.L); if(ds<best){best=ds;ahead=o;} }
    R.input.thr=1; R.input.brk=0;
    const tgt=ahead&&best<60?ahead.d:SIM.at(T,T.alpha,me.s+8);
    R.input.steer=Math.max(-1,Math.min(1,-(tgt-me.d)*0.8));
    SIM.step(R,1/60); if(me.damage>0||me.puncture) dmg++;
  }
  if(me.state==='out') outs++;
  laps+=me.lapsDone;
  othersOut+=R.cars.filter(c=>c.state==='out').length;
}
console.log(id,'noDnf',noDnf,'runs',runs,'player DNF',outs,'laps',laps,'frames with damage',dmg,'player contacts',contacts,'AI DNF total',othersOut);
