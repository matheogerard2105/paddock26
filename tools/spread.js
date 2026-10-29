const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
if(process.env.TUNE) globalThis.SIM_TUNE=JSON.parse(process.env.TUNE);
const {CIRCUITS,TEAMS_BASE}=m.exports; delete require.cache[require.resolve('../src/sim.js')]; const SIM=require('../src/sim.js');
const POLE={'au-1953':75.1,'cn-2004':90.6,'jp-1962':86.9,'bh-2002':89.8,'sa-2021':87.3,'us-2022':86.2,'ca-1978':70.9,'mc-1929':69.9,'es-1991':71.5,'at-1969':64.0,'gb-1948':84.9,'be-1925':100.5,'hu-1986':75.4,'nl-1948':68.7,'it-1922':78.8,'az-2016':101.1,'sg-2008':89.5,'us-2012':92.5,'mx-1962':75.6,'br-1940':69.5,'us-2023':92.3,'qa-2004':80.0,'ae-2009':82.2};
const e={team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]};
let L=[];let line='';
for(const c of CIRCUITS){ if(!POLE[c.id])continue; const T=SIM.buildTrack(c); const t=SIM.hotLap(T,e,0).t; const r=t/(POLE[c.id]*1.012); L.push(Math.log(r)); line+=c.id.slice(0,2)+':'+r.toFixed(3)+' ';}
const mean=L.reduce((a,b)=>a+b)/L.length, sd=Math.sqrt(L.reduce((a,b)=>a+(b-mean)**2,0)/L.length);
console.log('mean',Math.exp(mean).toFixed(3),'sd',sd.toFixed(4)); console.log(line);
