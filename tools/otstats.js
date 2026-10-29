const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [ids,laps='20',runs='2']=process.argv.slice(2);
const entries=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
for(const id of ids.split(',')){
 const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id)); const cat={lap1:0,pitcycle:0,lapped:0,track:0,swapback:0}; const pairs={};
 for(let r=0;r<+runs;r++){ const q=SIM.qualifying(T,entries); const R=SIM.createRace(T,q.map(x=>x.entry),{laps:+laps});
  const lastPit={}; let k=0;
  while(!R.over&&R.t<+laps*250){ SIM.step(R,1/60);
   for(;k<R.events.length;k++){ const e=R.events[k];
    if(e.type==='pit') lastPit[e.cars[0]]=R.t;
    if(e.type!=='overtake') continue;
    const [a,b]=e.cars, A=R.cars[a], B=R.cars[b];
    const key=a+'>'+b, rk=b+'>'+a;
    if(e.lap<=1) cat.lap1++;
    else if((lastPit[a]&&R.t-lastPit[a]<120)||(lastPit[b]&&R.t-lastPit[b]<120)||B.wear>0.8) cat.pitcycle++;
    else if(Math.abs(A.dist-B.dist)>T.L*0.5||A.lapsDone!==B.lapsDone) cat.lapped++;
    else if(pairs[rk]&&R.t-pairs[rk]<60) cat.swapback++;
    else cat.track++;
    pairs[key]=R.t;
   } } }
 for(const k in cat) cat[k]=(cat[k]/ +runs).toFixed(1);
 console.log(id, JSON.stringify(cat));
}
