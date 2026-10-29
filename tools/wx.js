const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id='gb-1948',laps='20',w='mixed']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
const R=SIM.createRace(T,TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d}))),{laps:+laps,weather:w});
let lap=-1;
while(!R.over&&R.t<+laps*300){ SIM.step(R,1/60); const L=R.ranked[0];
 if(L.lapsDone!==lap){lap=L.lapsDone; const ty={}; for(const c of R.cars) ty[c.tyre]=(ty[c.tyre]||0)+1; console.log('L'+lap,'rain',R.wx.rain.toFixed(2),'wet',R.wet.toFixed(2),'lastlap',SIM.fmtLap(L.lastLap),JSON.stringify(ty));} }
console.log(R.events.filter(e=>e.type==='wx').map(e=>e.msg).join(' | '));
