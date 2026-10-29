// sp par circuit pour le simulateur de stratégie : [rythme de course / tour de qualif, temps perdu par arrêt (s), surcoût du tour de départ (s)]
// calés sur de vraies courses à 22 voitures (RUNS courses de N tours, sans neutralisation) : pour chaque voiture,
// coût d'un arrêt = tours d'entrée + sortie comparés aux tours voisins (médiane) ; départ = surcoût du 1er tour ;
// rythme = ajusté pour que le temps total prévu (Σ essence + usure du modèle + arrêts + départ) colle au temps réel.
// Écrit "sp" dans src/circuits.js.  node tools/stratcal.js [ids]   (DRY=1 : n'écrit rien)
const fs=require('fs'); const CF=__dirname+'/../src/circuits.js';
const src=fs.readFileSync(CF,'utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m); const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const RUNS=+(process.env.RUNS||3), N=+(process.env.N||20), ALL=TEAMS_BASE.flatMap(t=>t.drivers.map(d=>({team:t,driver:d})));
const only=process.argv[2]?process.argv[2].split(','):null;
const avg=a=>a.reduce((p,v)=>p+v,0)/a.length;
let txt=fs.readFileSync(CF,'utf8');
for(const c of CIRCUITS){
  if(only&&!only.includes(c.id)) continue;
  const c0={...c}; delete c0.sp; const T=SIM.buildTrack(c0), Tq=SIM.buildTrack({...c0,useLine:true});
  const rows=[], lap1=[], pits=[];
  for(let r=0;r<RUNS;r++){
    const qq=SIM.qualifying(Tq,ALL,0), qt=new Map(qq.map(x=>[x.entry.driver.name,x.best]));
    const R=SIM.createRace(T,qq.map(x=>x.entry),{laps:N,wearMode:'prop',chaos:0.001});
    const log=R.cars.map(k=>({stints:[{tyre:k.tyre,a:1}],st:0})); let sc=false;
    while(!R.over&&R.t<N*400){ SIM.step(R,1/60); if(R.flag==='sc'||R.flag==='vsc') sc=true;
      R.cars.forEach((k,i)=>{ const L=log[i]; if(k.stops!==L.st){ L.st=k.stops; L.stints.push({tyre:k.tyre,a:k.lapsDone+2}); } }); }   // l'arrêt a lieu avant la ligne : le relais suivant commence au tour d'après
    if(sc) { r--; continue; }   // le modèle ne prévoit pas les neutralisations
    R.cars.forEach((k,i)=>{ const qb=qt.get(k.driver.name); if(k.state==='out'||!k.finishT||!(qb<900)||(k.finLaps??N)<N) return;
      const M=SIM.strategyModel(T,N,'prop',qb), base=qb*1.015, L=log[i].stints; let terms=0;
      L.forEach((s,j)=>{ const b=j+1<L.length?L[j+1].a-1:N; for(let l=s.a;l<=b;l++) terms+=M.lap(s.tyre,M.wearPerLap(s.tyre)*(l-s.a),l,l===s.a&&s.a>1)-base; });
      rows.push({y:k.finishT-R.startT-terms, x1:qb*N, x2:k.stops});
      const lt=l=>k.cross[l]!=null&&k.cross[l-1]!=null?k.cross[l]-k.cross[l-1]:null;
      for(const s of L.slice(1)){ const o=s.a, inn=o-1, a=lt(inn-1), b=lt(inn), cc=lt(o), d=lt(o+1); if([a,b,cc,d].every(v=>v!=null)&&inn>2&&o<N) pits.push(b+cc-a-d-0.9); }
      if(k.cross[1]!=null) lap1.push((k.cross[1]-R.startT)-(M.lap(L[0].tyre,0,1,false)-base)-qb*1.0);   // tour de départ, rapporté à un tour « au rythme qualif »
    });
  }
  const med=a=>{const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor(b.length/2)]:20;};
  const pit=med(pits); let rp=1.04, s0=0;
  for(let it=0;it<4;it++){
    rp=rows.reduce((p,o)=>p+o.x1*(o.y-pit*o.x2-s0),0)/rows.reduce((p,o)=>p+o.x1*o.x1,0);
    s0=avg(lap1)-(rp-1)*avg(rows.map(o=>o.x1/N));
  }
  const res=rows.map(o=>o.y-s0-rp*o.x1-pit*o.x2), sd=Math.sqrt(avg(res.map(v=>v*v)));
  const sp=[+rp.toFixed(4), +pit.toFixed(1), +s0.toFixed(1)];
  console.log(c.id.padEnd(9), c.name.padEnd(16), 'rythme ×'+sp[0], 'arrêt', sp[1]+' s', 'départ +'+sp[2]+' s', `(écart-type du temps total ${sd.toFixed(1)} s, n=${rows.length})`);
  txt=txt.replace(new RegExp('(\\{"id":"'+c.id+'",)("sp":\\[[0-9.,-]+\\],)?'),(_,x)=>x+'"sp":'+JSON.stringify(sp)+',');
  if(!process.env.DRY) fs.writeFileSync(CF,txt);   // écrit au fur et à mesure (un circuit raté ne fait pas tout perdre)
}
