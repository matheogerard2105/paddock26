"""Assemble l'application en un seul fichier HTML (autonome + version artefact)."""
import os, sys
LITE = 'essai' in sys.argv[1:]   # appli d'essai du Play Store : dist/paddock26-essai.html
H = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(H, 'src', f), encoding='utf-8').read()
body = src('template.html')
body = body.replace('/*__DATA__*/', src('circuits.js') + '\n' + src('teams.js') + '\n' + src('model.js'))
body = body.replace('/*__SIM__*/', src('sim.js'))
app = src('app.js')
if LITE:
    assert 'const LITE = false;' in app
    app = app.replace('const LITE = false;', 'const LITE = true;', 1)
body = body.replace('/*__APP__*/', src('mp4-muxer.js') + '\n' + src('i18n.js') + '\n' + app)
os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
if not LITE: open(os.path.join(H, 'dist', 'artifact.html'), 'w', encoding='utf-8').write(body)
full = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + body.replace('<main id="menu">', '</head>\n<body>\n<main id="menu">', 1) + '\n</body>\n</html>\n')
open(os.path.join(H, 'dist', 'paddock26-essai.html' if LITE else 'paddock26.html'), 'w', encoding='utf-8').write(full)
print('ok', len(full))
