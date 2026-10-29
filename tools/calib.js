const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const POLE={'au-1953':75.1,'cn-2004':90.6,'jp-1962':86.9,'bh-2002':89.8,'sa-2021':87.3,'us-2022':86.2,'ca-1978':70.9,'mc-1929':69.9,'es-1991':71.5,'at-1969':64.0,'gb-1948':84.9,'be-1925':100.5,'hu-1986':75.4,'nl-1948':68.7,'it-1922':78.8,'es-2026':0,'az-2016':101.1,'sg-2008':89.5,'us-2012':92.5,'mx-1962':75.6,'br-1940':69.5,'us-2023':92.3,'qa-2004':80.0,'ae-2009':82.2};
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
const res={};
for(const c of CIRCUITS){
  const target=POLE[c.id]*1.012;
  if(!POLE[c.id]){res[c.id]=1.0;continue;}
  let lo=0.6,hi=1.3;
  for(let it=0;it<14;it++){const g=(lo+hi)/2; const T=SIM.buildTrack({...c,grip:g,useLine:true}); const t=SIM.hotLap(T,e,0).t; if(t>target) lo=g; else hi=g;}
  const g=+((lo+hi)/2).toFixed(3); res[c.id]=g;
  const T=SIM.buildTrack({...c,grip:g,useLine:true}); const h=SIM.hotLap(T,e,0);
  console.log(c.name.padEnd(16),'grip',g,'lap',SIM.fmtLap(h.t),'target',SIM.fmtLap(target),'vmax',(h.vmax*3.6).toFixed(0));
}
fs.writeFileSync(__dirname+'/../src/grip.json',JSON.stringify(res));
