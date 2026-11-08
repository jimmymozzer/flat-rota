import itertools
weekly=["toilet","bath","ksink","hob2","worktops","hoover-kl","floor-bath","hall-hoover"]
wm={"toilet":20,"bath":20,"ksink":15,"hob2":20,"worktops":15,"hoover-kl":30,"floor-bath":25,"hall-hoover":10}
other=[("living",2,25,0,1),("fridge",2,30,0,0),("linens",2,15,0,1),("hallway",2,15,0,0),("kettle",4,10,1,1),("washer",4,30,3,0),("bathdeep",4,30,3,1),
("windows",4,30,1,0),("extractor",8,30,4,1),("skirting",8,40,4,0),("oven",12,60,9,1),("freezer",12,45,9,0)]
W=range(1,73); best=None
for ow in itertools.product([0,1],repeat=len(weekly)):
  o=dict(zip(weekly,ow))
  if o["hall-hoover"]!=o["floor-bath"]: continue
  base={w:[0,0] for w in W}
  for n in weekly:
    for w in W: base[w][(o[n]+w)%2]+=wm[n]
  for n,f,m,p,oo in other:
    for w in W:
      if w>=p and (w-p)%f==0: base[w][(oo+(w-p)//f)%2]+=m
  for ko,lp,lo,hp,ho in itertools.product([0,1],[0,1],[0,1],[0,1],[0,1]):
    t={w:base[w][:] for w in W}
    for (p,oo,m) in [(0,ko,20),(lp,lo,20),(hp,ho,15)]:
      for w in W:
        if (w-p)%2==0: t[w][(oo+(w-p)//2)%2]+=m
    d=[abs(a-b) for a,b in t.values()]; s=[a+b for a,b in t.values()]
    sc=(max(d),max(s)-min(s),sum(d))
    if best is None or sc<best[0]: best=(sc,o,dict(ko=ko,lp=lp,lo=lo,hp=hp,ho=ho),[t[w] for w in range(1,7)])
print(best)
