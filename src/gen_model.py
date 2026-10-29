"""Convertit F1.obj en données compactes (model.js) pour l'app.

Repère voiture de l'app : x vers l'avant, y vers le haut, z latéral, mètres.
Dans le fichier OBJ l'avant est +z (porte-à-faux le plus long, roues arrière plus larges à -z).
"""
import base64, json, math, os, struct, sys

H = os.path.dirname(os.path.abspath(__file__))
OBJ = sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, '..', '..', 'F1.obj')

V, N, groups, g = [], [], {}, 'default'
for line in open(OBJ, encoding='utf-8', errors='ignore'):
    p = line.split()
    if not p:
        continue
    if p[0] == 'v':
        V.append(tuple(map(float, p[1:4])))
    elif p[0] == 'vn':
        N.append(tuple(map(float, p[1:4])))
    elif p[0] == 'g':
        g = ' '.join(p[1:])
    elif p[0] == 'f':
        vs = []
        for t in p[1:]:
            a = t.split('/')
            vs.append((int(a[0]) - 1, int(a[2]) - 1 if len(a) > 2 and a[2] else None))
        groups.setdefault(g, []).append(vs)

allv = [V[i] for F in groups.values() for f in F for i, _ in f]
zmin, zmax = min(v[2] for v in allv), max(v[2] for v in allv)
ymin = min(v[1] for v in allv)
S = 5.4 / (zmax - zmin)          # longueur réglementaire ~5,4 m
SW = 0.87                        # largeur ramenée à ~1,9 m
zc = (zmin + zmax) / 2


def tf(v):                       # OBJ -> repère voiture
    return ((v[2] - zc) * S, (v[1] - ymin) * S, -v[0] * S * SW)


def tn(n):
    x, y, z = n[2], n[1], -n[0] / SW
    l = math.sqrt(x * x + y * y + z * z) or 1
    return (x / l, y / l, z / l)


def tris(F):
    out = []
    for f in F:
        for k in range(1, len(f) - 1):
            out.append((f[0], f[k], f[k + 1]))
    return out


def pack(tr, center=(0, 0, 0)):
    pos, nor = [], []
    for t in tr:
        for vi, ni in t:
            p = tf(V[vi])
            pos += [round((p[j] - center[j]) * 1000) for j in range(3)]
            n = tn(N[ni]) if ni is not None else (0, 1, 0)
            nor += [max(-127, min(127, round(c * 127))) for c in n]
    b = lambda fmt, a: base64.b64encode(struct.pack('<%d%s' % (len(a), fmt), *a)).decode()
    return b('h', pos), b('b', nor)


chassis = tris(groups['chasis'])
# zones de peinture par triangle : 0 carbone, 1 couleur écurie, 2 couleur secondaire
zones = []
for t in chassis:
    c = [sum(tf(V[vi])[j] for vi, _ in t) / 3 for j in range(3)]
    x, y, z = c
    if y < 0.1:
        zo = 0
    elif x > 2.05 and y < 0.42:
        zo = 2                    # aileron avant
    elif x < -1.95 and y > 0.5:
        zo = 2                    # aileron arrière
    elif abs(z) < 0.11 and y > 0.78 and -1.7 < x < 1.2:
        zo = 2                    # bande sur le capot
    else:
        zo = 1
    zones.append(zo)
cp, cn = pack(chassis)
wheels = []
for name, F in groups.items():
    if 'ruedas' not in name:
        continue
    pts = [tf(V[i]) for f in F for i, _ in f]
    cen = tuple((min(p[j] for p in pts) + max(p[j] for p in pts)) / 2 for j in range(3))
    wp, wn = pack(tris(F), cen)
    wheels.append({'c': [round(c, 3) for c in cen], 'p': wp, 'n': wn,
                   'r': round((max(p[1] for p in pts) - min(p[1] for p in pts)) / 2, 3),
                   'w': round(max(p[2] for p in pts) - min(p[2] for p in pts), 3)})
data = {'p': cp, 'n': cn, 'z': base64.b64encode(bytes(zones)).decode(), 'wheels': wheels}
open(os.path.join(H, 'model.js'), 'w').write('const CAR_MODEL=' + json.dumps(data, separators=(',', ':')) + ';\n')
print('triangles', len(chassis), 'roues', [(w['c'], w['r'], w['w']) for w in wheels])
