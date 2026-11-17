import json, math, os
raw = os.path.join(os.path.dirname(__file__), '..', 'raw', 'misc')
AU = 149597870.7
names = {'-31':'Voyager 1','-32':'Voyager 2','-23':'Pioneer 10','-24':'Pioneer 11','-98':'New Horizons'}
out = {"source":"JPL Horizons API (ssd.jpl.nasa.gov/api/horizons.api), EPHEM_TYPE=VECTORS, CENTER=@sun (body centre of Sun), REF_PLANE=ECLIPTIC (J2000 mean ecliptic & equinox), geometric states",
       "epoch":"2026-11-17 00:00 TDB (JD 2461361.5)","units":{"r_au":"AU","lon_deg":"ecliptic longitude J2000, 0..360","lat_deg":"ecliptic latitude J2000","speed_km_s":"heliocentric"},
       "licence":"JPL Horizons output, NASA public domain","spacecraft":[]}
for cid,name in names.items():
    d = json.load(open(f'{raw}/h{cid}.json'))['result']
    rows = [l for l in d.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()]
    v = [[float(x) for x in r.split(',')[2:5]] for r in rows]
    x,y,z = v[0]; r = math.sqrt(x*x+y*y+z*z)
    dv = [(b-a)/86400 for a,b in zip(v[0],v[1])]
    out["spacecraft"].append({"id":cid,"name":name,"r_au":round(r/AU,4),
        "lon_deg":round(math.degrees(math.atan2(y,x))%360,3),"lat_deg":round(math.degrees(math.asin(z/r)),3),
        "xyz_au":[round(c/AU,4) for c in v[0]],"speed_km_s":round(math.sqrt(sum(c*c for c in dv)),3)})
json.dump(out, open(os.path.join(os.path.dirname(__file__),'..','assets','data','spacecraft.json'),'w'), indent=1)
print(json.dumps(out["spacecraft"],indent=None))
