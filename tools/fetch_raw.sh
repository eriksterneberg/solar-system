#!/usr/bin/env bash
# Download the raw source data into raw/ (about 3 GB; the Mercury and Mars mosaics are ~760 MB each).
# Only needed to regenerate assets/ with the scripts in tools/ — the app itself runs from assets/.
# Usage: tools/fetch_raw.sh            (skips files that already exist)
set -euo pipefail
cd "$(dirname "$0")/.."

get() { # get <dest> <url>
  if [ -s "raw/$1" ]; then echo "have  raw/$1"; return; fi
  echo "fetch raw/$1"; curl -fL --retry 3 --create-dirs -o "raw/$1.part" "$2" && mv "raw/$1.part" "raw/$1"
}

USGS=https://planetarymaps.usgs.gov/mosaic
get mercury/enhanced_665m.tif  $USGS/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m.tif
get mars/mars_925m.tif         $USGS/Mars_Viking_ClrMosaic_global_925m.tif
get pluto/pluto.tif            $USGS/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif
get charon/charon.tif          $USGS/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif
get titan/titan.tif            $USGS/Titan_ISS_P19658_Mosaic_Global_4km.tif
get galilean/io_clr.tif        $USGS/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif
get galilean/europa.tif        $USGS/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif
get galilean/ganymede_clr.tif  $USGS/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif
get galilean/callisto.tif      $USGS/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif

SVS=https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720          # NASA SVS CGI Moon Kit
get moon/lroc_color_poles_4k.tif $SVS/lroc_color_poles_4k.tif
get moon/ldem_16_uint.tif        $SVS/ldem_16_uint.tif

PJ=https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia   # NASA Photojournal
get jupiter/PIA07782.tif  $PJ/pia07/pia07782/PIA07782.tif
get pluto/PIA19956.tif    $PJ/pia19/pia19956/PIA19956.tif

SSS=https://www.solarsystemscope.com/textures/download              # CC BY 4.0, attribution required
for f in 8k_saturn.jpg 2k_saturn_ring_alpha.png 4k_venus_atmosphere.jpg 8k_venus_surface.jpg 2k_uranus.jpg 2k_neptune.jpg; do get sss/$f $SSS/$f; done

get mpc/MPCORB.DAT.gz https://www.minorplanetcenter.net/iau/MPCORB/MPCORB.DAT.gz   # Minor Planet Center orbits

# Spacecraft state vectors from JPL Horizons (heliocentric, J2000 ecliptic), two days for position + speed.
# The committed spacecraft.json is for 2026-11-17; change START/STOP to update it.
START=2026-11-17; STOP=2026-11-18
for id in -31 -32 -23 -24 -98; do   # Voyager 1, Voyager 2, Pioneer 10, Pioneer 11, New Horizons
  get misc/h$id.json "https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='$id'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='@sun'&REF_PLANE='ECLIPTIC'&START_TIME='$START'&STOP_TIME='$STOP'&STEP_SIZE='1d'&VEC_TABLE='2'&CSV_FORMAT='YES'"
done
echo "done."
