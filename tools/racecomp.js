// rc par circuit : facteur d'adhérence qui compense la prudence de l'IA en course (comparée à un tour « pilote parfait »).
// Les IA reçoivent rc quand le joueur pilote ; rg (adhérence de piste en course) est divisé d'autant pour garder le rythme de course.
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m); const {CIRCUITS,TEAMS_BASE}=m.exports; globalThis.SIM_TUNE={}; const SIM=require('../src/sim.js');
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
let txt=fs.readFileSync(CF,'utf8');
for(const c of CIRCUITS){
  SIM_TUNE.HLRACE=0; const T=SIM.buildTrack(c); const target=SIM.hotLap(T,e,0).t;   // pilote parfait sur la piste de course
  SIM_TUNE.HLRACE=1; let lo=1,hi=1.25; for(let it=0;it<12;it++){ const g=(lo+hi)/2; const t=SIM.hotLap(T,e,g-1).t; if(t>target) lo=g; else hi=g; }
  SIM_TUNE.HLRACE=0; const rc=+((lo+hi)/2).toFixed(3), rg=+((c.rg||1)/rc).toFixed(3);
  txt=txt.replace(new RegExp('(\\{"id":"'+c.id+'",)("rc":[0-9.]+,)?'),(_,a)=>a+'"rc":'+rc+',');
  txt=txt.replace(new RegExp('(\\{"id":"'+c.id+'",[^{}]*?)"rg":[0-9.]+'),(_,a)=>a+'"rg":'+rg);
  console.log(c.name.padEnd(16),'rc',rc,'rg',c.rg,'→',rg);
}
fs.writeFileSync(CF,txt);
