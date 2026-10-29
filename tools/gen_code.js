// Génère le code de déblocage de la version complète pour un identifiant d'appareil (affiché dans la fenêtre « Version complète »)
// usage : node tools/gen_code.js <IDENTIFIANT>
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/app.js', 'utf8');
const salt = src.match(/const PRO_SALT = '([^']+)'/)[1];
const fn = src.match(/function proHash\(str\) \{[\s\S]*?\n\}/)[0];
const proHash = new Function(fn + '; return proHash;')();
const id = (process.argv[2] || '').trim().toUpperCase();
if (!id) { console.error('usage : node tools/gen_code.js <IDENTIFIANT>'); process.exit(1); }
const h = proHash(salt + ':' + id);
console.log(id, '→', h.slice(0, 5) + '-' + h.slice(5));
