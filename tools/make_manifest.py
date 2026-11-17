import os, json
from PIL import Image
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); A=R+'/assets'
PD='Public domain (NASA/USGS)'; SSS_L='CC BY 4.0'
SSS_A='Textures: Solar System Scope (solarsystemscope.com), CC BY 4.0 (based on NASA data)'
SSS='https://www.solarsystemscope.com/textures/'
U='https://planetarymaps.usgs.gov/mosaic/'
E='https://visibleearth.nasa.gov/collection/1484/blue-marble'
S={
'tex/mercury.jpg':(U+'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m.tif',PD,'NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington; USGS Astrogeology Science Center. MESSENGER MDIS enhanced-colour global mosaic (665 m/px).','MDIS enhanced colour (8, 5, 4 band composite), downsampled 23040x11520 -> 4096x2048'),
'tex/mercury_enhanced.jpg':('x','x','x',''),
'tex/venus.jpg':(SSS+'download/4k_venus_atmosphere.jpg',SSS_L,SSS_A,'Visible-light cloud deck (artistic/composite, not a photograph)'),
'tex/venus_surface.jpg':(SSS+'download/8k_venus_surface.jpg',SSS_L,SSS_A+'; Magellan radar data, NASA/JPL','Magellan radar-based false colour; 8192x4096 downsampled'),
'tex/earth_day.jpg':(E,PD,'NASA Earth Observatory, Blue Marble Next Generation (Reto Stockli)','copied/downsampled from apollo11-hd'),
'tex/earth_night.jpg':('https://earthobservatory.nasa.gov/features/NightLights',PD,'NASA Earth Observatory, Black Marble 2016 (NASA/Goddard/NOAA/Roman Wang)','downsampled from apollo11-hd'),
'tex/earth_clouds.jpg':(E,PD,'NASA Blue Marble cloud composite','greyscale; downsampled from apollo11-hd'),
'tex/earth_water.png':('derived',PD,'derived from NASA Blue Marble + GEBCO/NASA NEO; 255=water','resized 4096x2048 -> 2048x1024'),
'tex/moon.jpg':('https://svs.gsfc.nasa.gov/4720 (lroc_color_poles_4k.tif)',PD,'NASA/Goddard Space Flight Center Scientific Visualization Studio; LRO/LROC WAC (NASA/GSFC/Arizona State University), CGI Moon Kit','as supplied, 4096x2048, centred on 0 deg longitude'),
'tex/moon_height.jpg':('https://svs.gsfc.nasa.gov/4720 (ldem_16_uint.tif)',PD,'NASA/GSFC SVS; LRO LOLA (NASA/GSFC/MIT)','16-bit LDEM 5760x2880 downsampled to 2048x1024, linearly stretched 0.2-99.8 percentile (raw uint16 DN 6626..34310) to 8-bit grey; relative height only, absolute scale per SVS 4720 not applied'),
'tex/mars.jpg':(U+'Mars_Viking_ClrMosaic_global_925m.tif',PD,'NASA/JPL/USGS Astrogeology; Viking Orbiter global colour mosaic (925 m/px)','23059x11530 downsampled'),
'tex/jupiter.jpg':('https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map (PIA07782)',PD,'NASA/JPL/Space Science Institute (Cassini ISS)','native 3601x1801 upsampled (Lanczos) to 4096x2048'),
'tex/saturn.jpg':(SSS+'download/8k_saturn.jpg',SSS_L,SSS_A,'no public-domain Cassini global colour map of Saturn found; source file is 4096x2048'),
'tex/saturn_ring.png':(SSS+'download/2k_saturn_ring_alpha.png',SSS_L,SSS_A,'2048x125 resampled to 2048x64; premultiplied resample; spans 74,500 km (left) to 140,200 km (right) from Saturn centre'),
'tex/uranus.jpg':(SSS+'download/2k_uranus.jpg',SSS_L,SSS_A+' (Voyager 2)',''),
'tex/neptune.jpg':(SSS+'download/2k_neptune.jpg',SSS_L,SSS_A+' (Voyager 2)',''),
'tex/pluto.jpg':(U+'Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif + https://science.nasa.gov/photojournal/pluto-in-extended-color/ (PIA19956)',PD,'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute; USGS Astrogeology','300 m monochrome LORRI/MVIC mosaic (luminance) coloured with the PIA19956 enhanced colour map; rolled 180 deg; unseen south filled neutral'),
'tex/charon.jpg':(U+'Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',PD,'NASA/JHUAPL/SwRI; USGS Astrogeology','monochrome mosaic (slight warm-neutral tint added), rolled 180 deg; unseen south filled neutral'),
'tex/titan.jpg':(U+'Titan_ISS_P19658_Mosaic_Global_4km.tif',PD,'NASA/JPL-Caltech/Space Science Institute (Cassini ISS 938 nm mosaic, PIA19658); USGS Astrogeology','monochrome near-IR; rolled 180 deg'),
'tex/galilean/io.jpg':('see manifest source_note',PD,'NASA/JPL/USGS Astrogeology (Galileo SSI/Voyager)',''),
'tex/galilean/europa.jpg':(U+'Europa_Voyager_GalileoSSI_global_mosaic_500m.tif',PD,'NASA/JPL/USGS Astrogeology (Galileo SSI/Voyager)','monochrome'),
'tex/galilean/ganymede.jpg':('see manifest source_note',PD,'NASA/JPL/USGS Astrogeology (Galileo SSI/Voyager)',''),
'tex/galilean/callisto.jpg':(U+'Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif',PD,'NASA/JPL/USGS Astrogeology (Galileo SSI/Voyager)','monochrome'),
'sky/milkyway.jpg':('https://svs.gsfc.nasa.gov/4851',PD,'NASA/Goddard Space Flight Center Scientific Visualization Studio; Tycho/Hipparcos star catalogs','copied from apollo11-hd; 8192x4096 RA/Dec equirect, see sky/meta.json'),
'sky/stars.bin':('https://svs.gsfc.nasa.gov/4851 (Hipparcos/Tycho)',PD,'ESA Hipparcos/Tycho catalogues; NASA SVS','float32 LE [RA deg, Dec deg, Vmag, Kelvin]'),
'sky/meta.json':('apollo11-hd',PD,'',''),
'data/smallbodies.bin':('https://www.minorplanetcenter.net/iau/MPCORB/MPCORB.DAT.gz','Free for public/scientific use (MPC)','Minor Planet Center / IAU','see data/smallbodies.json'),
'data/smallbodies.json':('derived from MPCORB','Free for public/scientific use (MPC)','Minor Planet Center / IAU',''),
'data/spacecraft.json':('https://ssd.jpl.nasa.gov/api/horizons.api',PD,'NASA/JPL Horizons System','2026-11-17 00:00 TDB'),
}
extra=json.load(open(R+'/tools/source_overrides.json')) if os.path.exists(R+'/tools/source_overrides.json') else {}
files=[]
for root,_,fs in os.walk(A):
    for f in sorted(fs):
        p=os.path.join(root,f); rel=os.path.relpath(p,A)
        if rel in ('manifest.json','CREDITS.md'): continue
        e={'path':rel,'bytes':os.path.getsize(p)}
        if f.lower().endswith(('.jpg','.png')):
            im=Image.open(p); e['pixels']=list(im.size); e['mode']=im.mode
        s=S.get(rel)
        if s: e.update(source=s[0],licence=s[1],attribution=s[2],note=s[3])
        else: e.update(source='?',licence='?',attribution='?')
        e.update(extra.get(rel,{}))
        files.append(e)
files.sort(key=lambda e:e['path'])
json.dump({'generated':'2026-11-17','files':files,'vendor':{'path':'../vendor','note':'three.js r170 (MIT) copied from apollo11-hd/vendor'}},open(A+'/manifest.json','w'),indent=1)
for e in files: print(e['path'],e['bytes'],e.get('pixels',''),e['source'][:50])
