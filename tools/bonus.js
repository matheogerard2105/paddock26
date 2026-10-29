// Réglage complet des circuits bonus : adhérence (pole réaliste), adhérence de course rg et compensation rc.
// usage : node tools/bonus.js grip|race [ids]   (lancer minline / minline2 entre les deux étapes)
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const POLE={'my-1999':90.1,'pt-2008':78.3,'it-1953':74.7,'tr-2005':82.9,'fr-1969':91.1,'de-1932':71.8,'de-1927':85.3,'it-1914':75.1,'ru-2014':91.3,
  'fr-1960':72.0,'pt-1972':74.0,'br-1977':76.0,'us-1909':68.5,'ar-1952':75.0,'za-1961':78.0,'us-1956':88.0};
const load=()=>{const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';const m={exports:{}};new Function('module',src)(m);return m.exports;};
globalThis.SIM_TUNE={}; const SIM=require('../src/sim.js');
const [step, idsArg]=process.argv.slice(2); const {CIRCUITS,TEAMS_BASE}=load();
const ids=idsArg?idsArg.split(','):Object.keys(POLE);
const tm=TEAMS_BASE.find(t=>t.name==='Brackley Silver'); const e={team:tm,driver:tm.drivers[0]};
let txt=fs.readFileSync(CF,'utf8');
const setField=(id,k,v)=>{ const re=new RegExp('(\\{"id":"'+id+'",[^{}]*?)"'+k+'":[-0-9.]+'); if(re.test(txt)) txt=txt.replace(re,(_,a)=>a+'"'+k+'":'+v); else txt=txt.replace(new RegExp('(\\{"id":"'+id+'",)'),(_,a)=>a+'"'+k+'":'+v+','); };
for(const id of ids){
  const c=CIRCUITS.find(x=>x.id===id);
  if(step==='grip'){
    const target=POLE[id]*1.012; let lo=0.55,hi=1.4;
    for(let it=0;it<14;it++){ const g=(lo+hi)/2; const t=SIM.hotLap(SIM.buildTrack({...c,grip:g,useLine:true}),e,0).t; if(t>target) lo=g; else hi=g; }
    const g=+((lo+hi)/2).toFixed(3); setField(id,'grip',g);
    console.log(c.name.padEnd(16),'adhérence',g,'pole',SIM.fmtLap(SIM.hotLap(SIM.buildTrack({...c,grip:g,useLine:true}),e,0).t),'cible',SIM.fmtLap(target));
  } else {
    // rg : en course (ligne de courbure minimale, marges de course), l'IA tourne au même rythme que la pole
    const target=SIM.hotLap(SIM.buildTrack({...c,useLine:true}),e,0).t;
    SIM_TUNE.HLRACE=1; let lo=0.9,hi=1.4;
    for(let it=0;it<12;it++){ const g=(lo+hi)/2; const t=SIM.hotLap(SIM.buildTrack({...c,rg:g}),e,0).t; if(t>target) lo=g; else hi=g; }
    const rg=+((lo+hi)/2).toFixed(3);
    // rc : ce que la prudence de course coûte à l'IA (comparée à un pilote parfait sur la même piste)
    SIM_TUNE.HLRACE=0; const T=SIM.buildTrack({...c,rg}); const perfect=SIM.hotLap(T,e,0).t;
    SIM_TUNE.HLRACE=1; lo=1; hi=1.25; for(let it=0;it<12;it++){ const g=(lo+hi)/2; const t=SIM.hotLap(T,e,g-1).t; if(t>perfect) lo=g; else hi=g; }
    SIM_TUNE.HLRACE=0; const rc=+((lo+hi)/2).toFixed(3);
    setField(id,'rg',rg); setField(id,'rc',rc);
    console.log(c.name.padEnd(16),'rg',rg,'rc',rc);
  }
}
fs.writeFileSync(CF,txt);
