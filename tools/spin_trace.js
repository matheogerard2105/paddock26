const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id,laps='5']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const R=SIM.createRace(T,entries,{laps:+laps}); R.trace=true; let done=false;
while(!R.over && R.t<+laps*200 && !done){ const n=R.events.length; SIM.step(R,1/60);
  for(const e of R.events.slice(n)) if(/: tête-à-queue|gravier/.test(e.msg)&&!done){ done=true; console.log(e.msg,'t',R.t.toFixed(2)); const c=R.cars[e.cars[0]];
    console.log('flag',R.flag,'s',c.s.toFixed(1),'idx env',(SIM.at(T,T.env,c.s)*3.6).toFixed(0),'kRL',SIM.at(T,T.kRL,c.s).toFixed(4),'alpha',SIM.at(T,T.alpha,c.s).toFixed(2),'w',T.w,'lim',T.lim.toFixed(2),'errShift',c.errShift);
    for(const r of c.tr.slice(-60).filter((_,i)=>i%3==0)) console.log('  ',r.join(' | ')); } }
