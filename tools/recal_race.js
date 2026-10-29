// Ajuste rg pour que le meilleur tour en course (12 tours, moyenne de 2 courses) retrouve celui de l'ancienne physique
// usage : node tools/recal_race.js <ancien sim.js> <ancien circuits.js> [ids]
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const [oldSim, oldCirc, idsArg]=process.argv.slice(2);
const load=f=>{const src=fs.readFileSync(f,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';const m={exports:{}};new Function('module',src)(m);return m.exports;};
globalThis.SIM_TUNE={}; const NEW=require('../src/sim.js'), OLD=require(oldSim);
const cur=load(CF), old=load(oldCirc);
const ent=cur.TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const fl=(SIM,c)=>{ let s=0; for(let r=0;r<2;r++){ const R=SIM.createRace(SIM.buildTrack(c),ent,{laps:12,chaos:0}); while(!R.over&&R.t<4000) SIM.step(R,1/30); s+=R.fastest?R.fastest.t:0; } return s/2; };
let txt=fs.readFileSync(CF,'utf8');
const ids=idsArg?idsArg.split(','):cur.CIRCUITS.map(c=>c.id);
for(const id of ids){
  const c=cur.CIRCUITS.find(x=>x.id===id), o=old.CIRCUITS.find(x=>x.id===id);
  const fo=fl(OLD,o), fn=fl(NEW,c), rg=+((c.rg||1)*Math.pow(fn/fo,2)).toFixed(3);
  txt=txt.replace(new RegExp('(\\{"id":"'+id+'",[^{}]*?)"rg":[-0-9.]+'),(_,a)=>a+'"rg":'+rg); fs.writeFileSync(CF,txt);
  console.log(c.name.padEnd(16),'MT avant',NEW.fmtLap(fo),'maintenant',NEW.fmtLap(fn),'rg',c.rg,'→',rg);
}
