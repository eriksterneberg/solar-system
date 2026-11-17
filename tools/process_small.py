import os, shutil, numpy as np, tifffile
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); raw=R+'/raw'; T=R+'/assets/tex'
AP='/Users/eriksterneberg/workspace/space-experiences/apollo11-hd'
def save(im, name, size, q=88):
    im = im.convert('RGB').resize(size, Image.LANCZOS) if im.size!=size else im.convert('RGB')
    im.save(f'{T}/{name}', quality=q, optimize=True, subsampling=0 if size[0]<=2048 else 2); print(name, im.size)
# Earth
for s,d in [('day','earth_day'),('night','earth_night'),('clouds','earth_clouds')]:
    im = Image.open(f'{AP}/assets/earth/{s}.jpg'); print(s, im.size, im.mode)
    if im.size[0] > 4096: save(im, d+'.jpg', (4096,2048))
    else: shutil.copy(f'{AP}/assets/earth/{s}.jpg', f'{T}/{d}.jpg')
shutil.copy(f'{AP}/assets/earth/water.png', f'{T}/earth_water.png')
# sky / vendor
os.makedirs(R+'/assets/sky', exist_ok=True)
for f in ['milkyway.jpg','meta.json','stars.bin']: shutil.copy(f'{AP}/assets/sky/{f}', f'{R}/assets/sky/{f}')
if not os.path.exists(R+'/vendor'): shutil.copytree(AP+'/vendor', R+'/vendor')
# Moon
a = tifffile.imread(raw+'/moon/lroc_color_poles_4k.tif'); save(Image.fromarray(a), 'moon.jpg', (4096,2048))
h = tifffile.imread(raw+'/moon/ldem_16_uint.tif').astype(np.float32)
lo,hi = np.percentile(h,0.2), np.percentile(h,99.8); g = np.clip((h-lo)/(hi-lo),0,1)
Image.fromarray((g*255).astype(np.uint8)).resize((2048,1024), Image.LANCZOS).convert('RGB').convert('L').save(T+'/moon_height.jpg', quality=90); print('moon_height', lo, hi)
# Jupiter
j = tifffile.imread(raw+'/jupiter/PIA07782.tif'); save(Image.fromarray(j), 'jupiter.jpg', (4096,2048))
# SSS
S=raw+'/sss'
save(Image.open(S+'/4k_venus_atmosphere.jpg'),'venus.jpg',(4096,2048))
save(Image.open(S+'/8k_venus_surface.jpg'),'venus_surface.jpg',(4096,2048))
save(Image.open(S+'/8k_saturn.jpg'),'saturn.jpg',(4096,2048))
save(Image.open(S+'/2k_uranus.jpg'),'uranus.jpg',(2048,1024))
save(Image.open(S+'/2k_neptune.jpg'),'neptune.jpg',(2048,1024))
ring = Image.open(S+'/2k_saturn_ring_alpha.png').convert('RGBA'); print('ring', ring.size)
ra = np.asarray(ring); print('ring alpha min/max', ra[...,3].min(), ra[...,3].max(), 'rgb mean', ra[...,:3].mean((0,1)))
