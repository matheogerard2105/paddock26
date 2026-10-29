const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [ids,laps='20',runs='3',chaos='1',weather='dry']=process.argv.slice(2);
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
for(const id of ids.split(',')){
 const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id)); const agg={}; let dnf=0, wall=0, sim=0;
 for(let r=0;r<+runs;r++){ const q=SIM.qualifying(T,entries,weather==='heavy'?0.9:weather==='light'?0.4:0); const R=SIM.createRace(T,q.map(x=>x.entry),{laps:+laps,chaos:+chaos,weather});
  const w0=Date.now(); while(!R.over&&R.t<+laps*250) SIM.step(R,1/60); wall+=Date.now()-w0; sim+=R.t;
  for(const e of R.events){ const k=e.type==='sc'&&!e.msg.startsWith('SAFETY CAR DÉ')?'sc_other':e.type; agg[k]=(agg[k]||0)+1; }
  dnf+=R.cars.filter(c=>c.state==='out').length; }
 const f=x=>(x/ +runs).toFixed(1);
 console.log(id.padEnd(8),'laps',laps,'per race: OT',f(agg.overtake||0),'err',f(agg.error||0),'contact',f(agg.contact||0),'crash',f(agg.crash||0),'DNF',f(dnf),'SC',f(agg.sc||0),'VSC',f((agg.vsc||0)/2),'pit',f(agg.pit||0),'| ms/simsec',(wall/sim).toFixed(2));
}
