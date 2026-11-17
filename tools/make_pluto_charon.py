import os, numpy as np, tifffile
from PIL import Image
from scipy.ndimage import gaussian_filter as G, binary_erosion
Image.MAX_IMAGE_PIXELS=None
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); raw=R+'/raw'; T=R+'/assets/tex'
W,H=4096,2048
def grey_small(path, size):
    g=tifffile.imread(path); seen=(g>0)
    gi=Image.fromarray(g)
    f=int(round(g.shape[1]/size[0]/1.5))
    gi=gi.reduce(max(f,1)) if f>1 else gi
    L=np.asarray(gi.resize(size, Image.LANCZOS)).astype(np.float32)
    s=np.asarray(Image.fromarray(seen.astype(np.uint8)*255).reduce(max(int(g.shape[1]/size[0]),1)).resize(size, Image.BILINEAR)).astype(np.float32)/255
    return L, s>0.5
def _down(a,f):
    h,w=a.shape[:2]
    if a.ndim==2: return np.asarray(Image.fromarray(a.astype(np.float32)).resize((w//f,h//f),Image.BILINEAR))
    return np.stack([_down(a[...,c],f) for c in range(a.shape[-1])],-1)
def _up(a,shape):
    if a.ndim==2: return np.asarray(Image.fromarray(a.astype(np.float32)).resize((shape[1],shape[0]),Image.BILINEAR))
    return np.stack([_up(a[...,c],shape) for c in range(a.shape[-1])],-1)
def ext(val, mask, sig):
    f=8 if sig>=30 else 1
    v=_down(val,f) if f>1 else val; m=_down(mask.astype(np.float32),f) if f>1 else mask.astype(np.float32)
    s=sig/f; w=G(m,s,mode='nearest'); out=np.zeros_like(v)
    for c in range(v.shape[-1]): out[...,c]=G(v[...,c]*m,s,mode='nearest')/np.maximum(w,1e-6)
    if f>1: out=_up(out,val.shape); w=_up(w,mask.shape)
    return out, w
def ext_multi(val, mask, sigs=(40,120,350,900)):
    out=np.zeros_like(val); have=np.zeros(mask.shape,bool)
    for s in sigs:
        o,w=ext(val,mask,s); take=(w>0.02)&~have; out[take]=o[take]; have|=take
    return out
def roll(a): return np.roll(a, a.shape[1]//2, axis=1)   # 180-centred -> 0-centred
# ---- Pluto
Lg,Sg=grey_small(raw+'/pluto/pluto.tif',(W,H))
P=tifffile.imread(raw+'/pluto/PIA19956.tif')[...,:3]
pm=(P.max(-1)>3); pm=binary_erosion(pm,iterations=3)
Pm=np.asarray(Image.fromarray(pm.astype(np.uint8)*255).resize((W,H),Image.BILINEAR)).astype(np.float32)/255>0.98
Pf=np.asarray(Image.fromarray(P).resize((W,H),Image.LANCZOS)).astype(np.float32)
Lp=Pf@np.array([0.299,0.587,0.114],np.float32)
both=Pm&Sg
s=12
mp=G(Lp*both,s)/np.maximum(G(both.astype(np.float32),s),1e-6); mg=G(Lg*both,s)/np.maximum(G(both.astype(np.float32),s),1e-6)
k=(mp/np.maximum(mg,1.0))[...,None]
chroma=np.stack([G(Pf[...,c]*both,s) for c in range(3)],-1)/np.maximum(G(both.astype(np.float32),s),1e-6)[...,None]/np.maximum(mp,1.0)[...,None]
kk=ext_multi(np.concatenate([k,chroma],-1),both)
cc=kk[...,1:]; cm=cc.mean(-1,keepdims=True); sat=(0.45+0.55*G(both.astype(np.float32),20))[...,None]
cc=cm+(cc-cm)*sat
filled=Lg[...,None]*kk[...,:1]*cc
filled=np.clip(filled,0,255)
# unseen south: smooth boundary-colour gradient blended with neutral, feathered
def south_fill(img, seen, neutral, band=60, sx=150):
    H,W=seen.shape; edge=np.zeros((W,img.shape[-1]),np.float32)
    for x in range(W):
        ys=np.nonzero(seen[:,x])[0]; yb=ys.max() if len(ys) else H//2
        edge[x]=img[max(yb-band,0):yb+1,x].mean(0)
    ext_=np.concatenate([edge,edge,edge]); ext_=G(ext_,(sx,0))[W:2*W]
    row=np.arange(H)[:,None,None]/H
    fill=0.5*ext_[None]+0.5*np.asarray(neutral,np.float32)[None,None]
    fill=fill*(1.0-0.12*np.clip((row-0.6)/0.4,0,1))
    a=G(seen.astype(np.float32),12)[...,None]
    img=np.where(seen[...,None],img,fill)
    return a*img+(1-a)*fill
out=south_fill(np.where(Sg[...,None],filled,0),Sg,[150,138,128])
out=roll(np.clip(out,0,255).astype(np.uint8))
Image.fromarray(out).save(T+'/pluto.jpg',quality=88,optimize=True,subsampling=2); print('pluto',out.shape)
# ---- Charon (greyscale mosaic; neutral)
Lc,Sc=grey_small(raw+'/charon/charon.tif',(2048,1024))
Lo=south_fill(np.where(Sc,Lc,0)[...,None],Sc,[float(np.median(Lc[Sc]))],band=40,sx=100)[...,0]
rgb=np.stack([Lo*1.0,Lo*0.985,Lo*0.965],-1)
rgb=roll(np.clip(rgb,0,255).astype(np.uint8))
Image.fromarray(rgb).save(T+'/charon.jpg',quality=88,optimize=True); print('charon',rgb.shape)
sc=Image.new('RGB',(1024,768)); sc.paste(Image.open(T+'/pluto.jpg').resize((1024,512)),(0,0)); sc.paste(Image.open(T+'/charon.jpg').resize((512,256)),(0,512))
sc.save('/private/tmp/claude-501/-Users-eriksterneberg-workspace-space-experiences/a9593486-e305-4da5-afbd-cdd5e0adba3a/scratchpad/pc.png')
