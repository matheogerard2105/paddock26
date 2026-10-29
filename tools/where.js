const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id,laps='15',show='3']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const R=SIM.createRace(T,entries,{laps:+laps,weather:process.argv[5]||'dry'}); R.trace=true;
const hist={}; const modes={}; let n=0;
while(!R.over && R.t<+laps*200){ const k=R.events.length; SIM.step(R,1/60);
 for(const e of R.events.slice(k)) if(/gravier|tête-à-queue !|mur/.test(e.msg)){ const c=R.cars[e.cars[0]]; const b=Math.round(c.s/50)*50; hist[b]=(hist[b]||0)+1;
   const tr=c.tr||[]; const r=tr[tr.length-30]||[]; const key=(r[10]||'?')+' side'+((r[13]||'').length>0?1:0); modes[key]=(modes[key]||0)+1;
   if(n++<+show) { console.log('##',e.msg,'flag',R.flag); for(const x of tr.slice(-70).filter((_,i)=>i%5==0)) console.log('   ',[x[0],x[1],x[2],x[9],x[10],x[11],x[12],...x.slice(14)].join(' | ')); } } }
console.log(hist); console.log(modes);
