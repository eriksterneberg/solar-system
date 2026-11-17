import os, sys, numpy as np, tifffile
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); raw=R+'/raw'; T=R+'/assets/tex'
SC='/private/tmp/claude-501/-Users-eriksterneberg-workspace-space-experiences/a9593486-e305-4da5-afbd-cdd5e0adba3a/scratchpad'
def big(path, size, planar=None, q=88, out=None, roll=False):
    a=tifffile.imread(path)
    if a.ndim==3 and a.shape[0] in (3,4) and a.shape[0]<a.shape[-1]: a=np.moveaxis(a[:3],0,-1)  # planar (3,H,W)
    if a.ndim==3: a=a[...,:3]
    h,w=a.shape[:2]; f=max(int(w/size[0]/1.2),1)
    ims=[Image.fromarray(np.ascontiguousarray(a[...,c] if a.ndim==3 else a)).reduce(f).resize(size,Image.LANCZOS) for c in range(3 if a.ndim==3 else 1)]
    im=Image.merge('RGB',ims) if len(ims)==3 else ims[0].convert('RGB')
    if roll: im=Image.fromarray(np.roll(np.asarray(im),size[0]//2,axis=1))
    im.save(out,quality=q,optimize=True,subsampling=2 if size[0]>2048 else 0); print(out.split('/')[-1],im.size,'src',(w,h)); return im
def mercury():
    im=big(raw+'/mercury/enhanced_665m.tif',(4096,2048),out=T+'/mercury_enhanced.jpg')
    a=np.asarray(im).astype(np.float32); L=a@np.array([0.299,0.587,0.114],np.float32)
    nat=L[...,None]+(a-L[...,None])*0.22              # keep 22% of the enhanced chroma
    nat=nat*np.array([1.04,1.0,0.94],np.float32)       # slight warm-neutral
    nat=np.clip(nat,0,255); lo,hi=np.percentile(nat,0.5),np.percentile(nat,99.7); nat=np.clip((nat-lo)/(hi-lo),0,1)**1.0*255
    Image.fromarray(nat.astype(np.uint8)).save(T+'/mercury.jpg',quality=88,optimize=True,subsampling=2); print('mercury.jpg natural-muted')
which=sys.argv[1:]
jobs={
 'mercury':lambda: mercury(),
 'mars':lambda: big(raw+'/mars/mars_925m.tif',(4096,2048),out=T+'/mars.jpg'),
 'titan':lambda: big(raw+'/titan/titan.tif',(2048,1024),out=T+'/titan.jpg',roll=True),
 'io':lambda: big(raw+'/galilean/io_clr.tif',(2048,1024),out=T+'/galilean/io.jpg',roll=True),
 'europa':lambda: big(raw+'/galilean/europa.tif',(2048,1024),out=T+'/galilean/europa.jpg',roll=True),
 'ganymede':lambda: big(raw+'/galilean/ganymede_clr.tif',(2048,1024),out=T+'/galilean/ganymede.jpg',roll=True),
 'callisto':lambda: big(raw+'/galilean/callisto.tif',(2048,1024),out=T+'/galilean/callisto.jpg',roll=True),
}
for k in which: jobs[k]()
