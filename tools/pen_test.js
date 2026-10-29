// robot qui coupe volontairement dans l'herbe pour tester les limites de piste, puis vérifie la SC
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id==='bh-2002'));
const R=SIM.createRace(T,[{team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]}],{laps:2,human:0,assist:true,level:'pro'});
const me=R.cars[0]; let k=0;
while(!R.over&&R.t<400){ const env=SIM.at(T,T.env,me.s+25)*0.85; R.input.thr=me.v<env?1:0; R.input.brk=0;
  const wantD = (Math.floor(R.t/12)%2) ? T.w/2+2.5 : 0; R.input.steer=Math.max(-1,Math.min(1,-(wantD-me.d)*0.4)); SIM.step(R,1/60); }
console.log('infractions',me.tl,'pénalité',me.penalty); console.log(R.events.filter(e=>/Limites|PÉNALITÉ/.test(e.msg)).map(e=>e.msg).join('\n'));
