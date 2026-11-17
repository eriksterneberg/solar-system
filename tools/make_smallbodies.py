import gzip, json, math, os, random, struct, sys
import numpy as np
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'raw', 'mpc', 'MPCORB.DAT.gz')
def unpack_digit(c): return int(c) if c.isdigit() else ord(c) - 55
def epoch_jd(p):
    y = {'I':1800,'J':1900,'K':2000}[p[0]] + int(p[1:3]); m = unpack_digit(p[3]); d = unpack_digit(p[4])
    a = (14 - m)//12; yy = y + 4800 - a; mm = m + 12*a - 3
    jdn = d + (153*mm+2)//5 + 365*yy + yy//4 - yy//100 + yy//400 - 32045
    return jdn - 0.5   # 0h TT
rows = []; named = {}
want = {1:'Ceres',4:'Vesta',90377:'Sedna',134340:'Pluto',136108:'Haumea',136199:'Eris',136472:'Makemake',486958:'Arrokoth'}
started = False
with gzip.open(src, 'rt', errors='replace') as f:
    for line in f:
        if not started:
            if line.startswith('-----'): started = True
            continue
        if len(line) < 104 or not line[91:103].strip(): continue
        try:
            H = float(line[8:13]) if line[8:13].strip() else 22.0
            rec = (float(line[92:103]), float(line[70:79]), float(line[59:68]), float(line[48:57]),
                   float(line[37:46]), float(line[26:35]), epoch_jd(line[20:25].strip()), H)
        except Exception: continue
        if not (0 <= rec[1] < 1) or rec[0] <= 0: continue
        rows.append(rec)
        nm = line[166:194].strip()
        if nm.startswith('('):
            num = int(nm[1:nm.index(')')])
            if num in want: named[want[num]] = rec
print('parsed', len(rows))
arr = np.array(rows, dtype=np.float64)
a = arr[:,0]
tno = arr[a > 30]; inner = arr[a <= 30]
rng = np.random.default_rng(42)
idx = rng.choice(len(inner), 60000, replace=False); idx.sort()
sub = inner[idx]
out = np.concatenate([sub, tno]).astype('<f4')
out.tofile(os.path.join(root,'assets','data','smallbodies.bin'))
def hist(x, edges): 
    h,_ = np.histogram(x, edges); return {f'{edges[i]}-{edges[i+1]}':int(h[i]) for i in range(len(h))}
meta = {"file":"smallbodies.bin","dtype":"float32 little-endian","record_floats":8,
 "record_layout":["a_AU","e","i_deg","Omega_deg","omega_deg","M_deg_at_epoch","epoch_JD_TT","H_absmag"],
 "angles":"ecliptic J2000 heliocentric osculating elements; M is mean anomaly at the per-object epoch (column 7); epochs differ per object (mostly 2026 MPC epoch); propagate with n = 0.9856076686/a^1.5 deg/day",
 "counts":{"total":int(len(out)),"inner_subsample_a_le_30":int(len(sub)),"trans_neptunian_a_gt_30":int(len(tno)),"parsed_from_MPCORB":int(len(arr))},
 "order":"first 60000 records are the random (seed 42) a<=30 AU subsample sorted by MPC file order; remaining records are all a>30 AU with e<1",
 "source":"Minor Planet Center MPCORB.DAT (minorplanetcenter.net/iau/MPCORB.html), downloaded 2026-11-17",
 "licence":"MPC data, free for scientific/public use; credit Minor Planet Center / IAU",
 "float32_note":"epoch JD (~2.46e6) stored as float32 has resolution of 0.25 day; fine for display",
 "a_histogram_inner_subsample":hist(sub[:,0],[0,1,1.7,2.0,2.5,2.82,3.3,4,5.5,6,10,30]),
 "a_histogram_trans_neptunian":hist(tno[:,0],[30,35,40,45,50,60,100,200,500,1e5]),
 "named":{k:dict(zip(["a","e","i","Omega","omega","M","epoch_JD"],map(float,v[:7]))) | {"name":k,"H":float(v[7])} for k,v in named.items()}}
json.dump(meta, open(os.path.join(root,'assets','data','smallbodies.json'),'w'), indent=1)
print(json.dumps(meta['counts']), json.dumps(meta['a_histogram_inner_subsample']), json.dumps(meta['a_histogram_trans_neptunian']))
print(json.dumps(meta['named'].get('Pluto')), sorted(named))
