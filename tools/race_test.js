const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id,laps='15',verbose]=process.argv.slice(2);
const c=CIRCUITS.find(x=>x.id===id); const T=SIM.buildTrack(c);
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
let t0=Date.now(); const q=SIM.qualifying(T,entries); const tq=Date.now()-t0;
console.log('QUALI ms',tq, q.slice(0,5).map(r=>r.entry.driver.name.split(' ')[1]+' '+SIM.fmtLap(r.best)).join(', '), '... last', SIM.fmtLap(q[21].best));
const R=SIM.createRace(T,q.map(r=>r.entry),{laps:+laps});
t0=Date.now(); const dt=1/60; let steps=0;
while(!R.over && R.t<laps*200){ SIM.step(R,dt); steps++; }
const el=Date.now()-t0;
console.log('race sim time',R.t.toFixed(0),'s, wall',el,'ms, per sim-second',(el/R.t).toFixed(2),'ms');
const cnt={}; for(const e of R.events) cnt[e.type]=(cnt[e.type]||0)+1; console.log(cnt);
if(verbose) for(const e of R.events) if(e.type!=='fastest') console.log('  L'+e.lap, e.t.toFixed(0), e.msg);
for(const cc of R.ranked) console.log(String(cc.pos).padStart(2), cc.code, 'grid',String(cc.gridPos).padStart(2), cc.state, 'gap', cc.gap==null?'OUT':cc.gap.toFixed(1), 'best', SIM.fmtLap(cc.bestLap),'stops',cc.stops,'tyre',cc.tyre,'wear',cc.wear.toFixed(2),'soc',(cc.soc/1e6).toFixed(2), cc.retiredWhy||'');
