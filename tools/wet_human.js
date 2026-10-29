// Le joueur roule « comme sur le sec » : quel temps selon le pneu et l'humidité ?
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/circuits.js','utf8')+fs.readFileSync(__dirname+'/../src/teams.js','utf8')+';module.exports={CIRCUITS,TEAMS_BASE};';
const m={exports:{}}; new Function('module',src)(m);
const {CIRCUITS,TEAMS_BASE}=m.exports; const SIM=require('../src/sim.js');
const [id='bh-2002',lvl='pro',assist='on']=process.argv.slice(2);
const T=SIM.buildTrack(CIRCUITS.find(x=>x.id===id));
for(const [wx,tyre] of [['dry','M'],['light','M'],['light','I'],['heavy','M'],['heavy','I'],['heavy','W']]){
  const R=SIM.createRace(T,[{team:TEAMS_BASE[0],driver:TEAMS_BASE[0].drivers[0]}],{laps:3,human:0,assist,level:lvl,weather:wx});
  const me=R.cars[0]; me.tyre=tyre; R.wx.target=R.wx.rain; let off=0,n=0;
  while(!R.over&&R.t<900&&me.state!=='out'){
    const env=SIM.at(T,T.env,me.s+25)*0.95, al=SIM.at(T,T.alpha,me.s+8);
    R.input.thr=me.v<env?1:0; R.input.brk=me.v>env+3?1:0;
    R.input.steer=Math.max(-1,Math.min(1,-(al-me.d)*0.5));
    SIM.step(R,1/60); n++; if(me.offTrack) off++;
  }
  console.log(wx.padEnd(5),tyre,'wet',R.wet.toFixed(2),'best',SIM.fmtLap(me.bestLap),'off%',(off/n*100).toFixed(0),me.state,me.retiredWhy||'',R.events.filter(e=>e.type==='error').length+' erreurs');
}
