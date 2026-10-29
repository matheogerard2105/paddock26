// Temps au tour par pneu, usure et humidité (tour lancé, seul, peu d'essence)
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
const lap=(T,tyre,wet,wear)=>{const r=SIM.hotLap(T,e,0,undefined,false,wet,{tyre,wear}); return r.t;};
for(const id of process.argv.slice(2)){ const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
  const ref=lap(T,'M',0,0), f=t=>t>=999?' DNF ':(t>=ref?'+':'')+(t-ref).toFixed(1);
  console.log(`${id} M sec neuf ${SIM.fmtLap(ref)}`);
  console.log('  usure M  0.3/0.6/0.9/1.0 :',[0.3,0.6,0.9,1.0].map(w=>f(lap(T,'M',0,w))).join('  '), '| S 0.6/0.9:',[0.6,0.9].map(w=>f(lap(T,'S',0,w))).join(' '),'| H 0.6/0.9:',[0.6,0.9].map(w=>f(lap(T,'H',0,w))).join(' '));
  for(const w of [0,0.1,0.25,0.4,0.6,0.8,1]) console.log(`  piste ${w}: M ${f(lap(T,'M',w,0))}  I ${f(lap(T,'I',w,0))}  W ${f(lap(T,'W',w,0))}`);
}
