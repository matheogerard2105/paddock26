// Recalage après un changement de physique : pour chaque circuit, retrouve les mêmes temps qu'avec l'ancienne version
// (tour de qualif « grip » sur la trajectoire de qualif, tour au comportement de course « rg » sur la piste de course).
// usage : node tools/recal_physics.js <ancien sim.js> <ancien circuits.js> [ids]
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const [oldSim, oldCirc, idsArg]=process.argv.slice(2);
const load=f=>{const src=fs.readFileSync(f,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';const m={exports:{}};new Function('module',src)(m);return m.exports;};
globalThis.SIM_TUNE={};
const NEW=require('../src/sim.js'); const OLD=require(oldSim);
const cur=load(CF), old=load(oldCirc);
const tm=cur.TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
let txt=fs.readFileSync(CF,'utf8');
const setField=(id,k,v)=>{ const re=new RegExp('(\\{"id":"'+id+'",[^{}]*?)"'+k+'":[-0-9.]+'); if(re.test(txt)) txt=txt.replace(re,(_,a)=>a+'"'+k+'":'+v); else txt=txt.replace(new RegExp('(\\{"id":"'+id+'",)'),(_,a)=>a+'"'+k+'":'+v+','); };
const ids=idsArg?idsArg.split(','):cur.CIRCUITS.map(c=>c.id);
for(const id of ids){
  const c=cur.CIRCUITS.find(x=>x.id===id), o=old.CIRCUITS.find(x=>x.id===id);
  SIM_TUNE.HLRACE=0; const tq=OLD.hotLap(OLD.buildTrack({...o,useLine:true}),e,0).t;
  let lo=0.4,hi=1.6; for(let it=0;it<14;it++){ const g=(lo+hi)/2; const t=NEW.hotLap(NEW.buildTrack({...c,grip:g,useLine:true}),e,0).t; if(t>tq) lo=g; else hi=g; }
  const grip=+((lo+hi)/2).toFixed(3);
  if (process.env.GRIPONLY) { setField(id,'grip',grip); fs.writeFileSync(CF,txt); console.log(c.name.padEnd(16),'qualif',NEW.fmtLap(tq),'grip',c.grip,'→',grip); continue; }
  SIM_TUNE.HLRACE=1; const tr=OLD.hotLap(OLD.buildTrack(o),e,0).t;
  lo=0.7; hi=1.8; for(let it=0;it<14;it++){ const g=(lo+hi)/2; const t=NEW.hotLap(NEW.buildTrack({...c,grip,rg:g}),e,0).t; if(t>tr) lo=g; else hi=g; }
  SIM_TUNE.HLRACE=0; const rg=+((lo+hi)/2).toFixed(3);
  setField(id,'grip',grip); setField(id,'rg',rg); fs.writeFileSync(CF,txt);
  console.log(c.name.padEnd(16),'qualif',NEW.fmtLap(tq),'grip',c.grip,'→',grip,'| course',NEW.fmtLap(tr),'rg',c.rg,'→',rg);
}
