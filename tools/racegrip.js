// rg par circuit : facteur d'adhérence de course pour que la ligne de courbure minimale (course) donne le même tour
// que la trajectoire temps minimal des qualifs. Écrit "rg" dans src/circuits.js
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m); const {CIRCUITS,TEAMS_BASE}=m.exports; globalThis.SIM_TUNE={}; const SIM=require('../src/sim.js');
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
let txt=fs.readFileSync(CF,'utf8');
for(const c of CIRCUITS){
  SIM_TUNE.KT=undefined; const target=SIM.hotLap(SIM.buildTrack({...c,useLine:true}),e,0).t;
  SIM_TUNE.KT=0.6;   // en course l'IA garde sa prudence hors trajectoire
  let lo=0.95,hi=1.25; for(let it=0;it<12;it++){ const g=(lo+hi)/2; const t=SIM.hotLap(SIM.buildTrack({...c,rg:g}),e,0).t; if(t>target) lo=g; else hi=g; }
  SIM_TUNE.KT=undefined; const rg=c.line||true?+((lo+hi)/2).toFixed(3):1;
  txt=txt.replace(new RegExp('(\\{"id":"'+c.id+'",)("rg":[0-9.]+,)?'),(_,a)=>a+(rg!==1?'"rg":'+rg+',':''));
  console.log(c.name.padEnd(16),'rg',rg,'cible',SIM.fmtLap(target));
}
fs.writeFileSync(CF,txt);
