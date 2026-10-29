import json, math
d=json.load(open(__import__('sys').argv[1]))
F={f['properties']['id']:f for f in d['features']}
# id, nom, drapeau, tours réels, largeur piste (m), circuit urbain, longueur officielle (m)
META=[
('au-1953','Australie','Albert Park · Melbourne','🇦🇺',58,13,1,5278),
('cn-2004','Chine','Shanghai International Circuit','🇨🇳',56,15,0,5451),
('jp-1962','Japon','Suzuka','🇯🇵',53,13,0,5807),
('bh-2002','Bahreïn','Sakhir','🇧🇭',57,15,0,5412),
('sa-2021','Arabie Saoudite','Jeddah Corniche','🇸🇦',50,12,1,6174),
('us-2022','Miami','Miami International Autodrome','🇺🇸',57,13,1,5412),
('ca-1978','Canada','Circuit Gilles-Villeneuve','🇨🇦',70,12,1,4361),
('mc-1929','Monaco','Circuit de Monaco','🇲🇨',78,8,1,3337),
('es-1991','Barcelone','Circuit de Barcelona-Catalunya','🇪🇸',66,14,0,4657),
('at-1969','Autriche','Red Bull Ring','🇦🇹',71,14,0,4318),
('gb-1948','Grande-Bretagne','Silverstone','🇬🇧',52,15,0,5891),
('be-1925','Belgique','Spa-Francorchamps','🇧🇪',44,14,0,7004),
('hu-1986','Hongrie','Hungaroring','🇭🇺',70,13,0,4381),
('nl-1948','Pays-Bas','Zandvoort','🇳🇱',72,12,0,4259),
('it-1922','Italie','Monza','🇮🇹',53,14,0,5793),
('es-2026','Espagne','Madring · Madrid','🇪🇸',57,13,1,5474),
('az-2016','Azerbaïdjan','Bakou City Circuit','🇦🇿',51,9.5,1,6003),
('sg-2008','Singapour','Marina Bay','🇸🇬',62,11,1,4940),
('us-2012','États-Unis','Circuit of the Americas','🇺🇸',56,15,0,5513),
('mx-1962','Mexique','Hermanos Rodríguez','🇲🇽',71,14,0,4304),
('br-1940','Brésil','Interlagos','🇧🇷',71,13,0,4309),
('us-2023','Las Vegas','Las Vegas Strip Circuit','🇺🇸',50,12,1,6201),
('qa-2004','Qatar','Lusail','🇶🇦',57,14,0,5419),
('ae-2009','Abou Dhabi','Yas Marina','🇦🇪',58,14,0,5281),
]
out=[]
GRIP=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'grip.json')))
_ts=__import__('os').path.join(__import__('os').path.dirname(__file__),'tyre_sens.json')
TSENS=json.load(open(_ts)) if __import__('os').path.exists(_ts) else {}
for (i,name,sub,flag,laps,w,street,L) in META:
  c=F[i]['geometry']['coordinates']
  if math.hypot(c[0][0]-c[-1][0],c[0][1]-c[-1][1])<1e-7: c=c[:-1]
  lat0=sum(p[1] for p in c)/len(c)
  kx=111320*math.cos(math.radians(lat0)); ky=110540
  xs=[(p[0]-c[0][0])*kx for p in c]; ys=[(p[1]-c[0][1])*ky for p in c]
  n=len(xs); Lr=sum(math.hypot(xs[(k+1)%n]-xs[k],ys[(k+1)%n]-ys[k]) for k in range(n))
  sc=L/Lr
  pts=[]
  for x,y in zip(xs,ys): pts+= [round(x*sc,1), round(y*sc,1)]
  out.append(dict(id=i,name=name,sub=sub,flag=flag,laps=laps,width=w,street=street,length=L,grip=GRIP.get(i,1.0),tsens=TSENS.get(i),pts=pts))
s='const CIRCUITS='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n'
open(__import__('sys').argv[2],'w').write(s); print(len(s))
