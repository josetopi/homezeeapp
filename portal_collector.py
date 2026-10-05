"""Homezee public-page collectors. No login, proxy rotation or challenge bypass."""
import concurrent.futures, hashlib, html, json, math, os, re, threading, time, unicodedata
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parent
UA='HomezeePrototype/1.0'
TTL=300
CACHE={}; LOCK=threading.Lock(); TASKS={}; INTEREST={}
REGIONS={'braga':'braga','guimaraes':'braga','esposende':'braga','barcelos':'braga','vila-nova-de-famalicao':'braga','porto':'porto','matosinhos':'porto','vila-nova-de-gaia':'porto','maia':'porto','gondomar':'porto','lisboa':'lisboa','sintra':'lisboa','cascais':'lisboa','oeiras':'lisboa','loures':'lisboa','faro':'faro','albufeira':'faro','lagos':'faro','portimao':'faro','loule':'faro','tavira':'faro','coimbra':'coimbra','aveiro':'aveiro','leiria':'leiria','viseu':'viseu','setubal':'setubal','evora':'evora','beja':'beja','braganca':'braganca','castelo-branco':'castelo-branco','viana-do-castelo':'viana-do-castelo','vila-real':'vila-real','santarem':'santarem','guarda':'guarda','cabeceiras-de-basto':'braga','povoa-de-varzim':'porto','vila-do-conde':'porto'}
def norm(x):return ''.join(c for c in unicodedata.normalize('NFD',str(x)) if unicodedata.category(c)!='Mn').lower().strip()
def slug(x):return re.sub(r'[^a-z0-9]+','-',norm(x)).strip('-')
def text(x):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',x or ''))).strip()
def number(x):
 try:return float(str(x).replace(' ','').replace('.','').replace(',','.'))
 except ValueError:return None

def fetch(url):
 # Fixed portal hosts only. Never fetch user-supplied URLs.
 if urlsplit(url).hostname not in ('www.imovirtual.com','www.idealista.pt'):raise ValueError('Fonte inválida')
 req=Request(url,headers={'User-Agent':UA,'Accept':'text/html','Accept-Language':'pt-PT'})
 with urlopen(req,timeout=18) as r:
  if urlsplit(r.url).hostname not in ('www.imovirtual.com','www.idealista.pt'):raise ValueError('Redirecionamento não suportado')
  data=r.read(6000001)
  if len(data)>6000000:raise ValueError('Página demasiado grande')
  return data.decode('utf-8',errors='replace')

def map_location(location):
 location=location or {};details=location.get('mapDetails') or {};point=location.get('coordinates') or details.get('coordinates') or {}
 point=point if isinstance(point,dict) else {}
 lat=point.get('latitude',point.get('lat'));lon=point.get('longitude',point.get('lon',point.get('lng')))
 if lat is None:lat=details.get('latitude')
 if lon is None:lon=details.get('longitude')
 geo=None
 try:
  if lat is not None and lon is not None and -90<=float(lat)<=90 and -180<=float(lon)<=180:geo=dict(lat=float(lat),lon=float(lon),approximate=True)
 except (ValueError,TypeError):pass
 locations=(location.get('reverseGeocoding') or {}).get('locations') or []
 query=', '.join(l.get('name','') for l in locations[::-1] if l.get('name'))
 street=((location.get('address') or {}).get('street') or {}).get('name')
 if street:query=street+', '+query
 return dict(geo=geo,mapQuery=query)

def parse_imovirtual(raw):
 m=re.search(r'<script\b[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',raw,re.S)
 if not m:raise ValueError('Estrutura de página não reconhecida; pode existir bloqueio')
 p=json.loads(m[1])['props']['pageProps'];search=p['data']['searchAds'];out=[]
 for x in search['items']:
  if x.get('transaction')!='SELL':continue
  price=(x.get('totalPrice') or {}).get('value');photos=[i.get('large') or i.get('medium') for i in (x.get('images') or []) if isinstance(i,dict)];photos=[i for i in photos if i and i.startswith('https://')]
  if price is None or not photos:continue
  locations=((x.get('location') or {}).get('reverseGeocoding') or {}).get('locations') or []
  city=next((l['name'] for l in locations if l.get('locationLevel')=='council'),(p.get('locationName') or '').split(',')[0])
  address=', '.join(l['name'] for l in locations[::-1])
  typ={'FLAT':'Apartamento','HOUSE':'Moradia','TERRAIN':'Terreno','FARM':'Quinta'}.get(x.get('estate'),'Outro')
  match=re.search(r'\bT(\d+)\b',x['title'],re.I)
  # Portal roomsNumber can include living rooms; never treat it as bedrooms.
  beds=int(match[1]) if match else (0 if typ=='Terreno' else None)
  out.append(dict(id='imovirtual:'+str(x['id']),title=x['title'],city=city,address=address,type=typ,price=float(price),beds=beds,size=x.get('areaInSquareMeters') or x.get('terrainAreaInSquareMeters'),photos=photos,img=photos[0],url='https://www.imovirtual.com/pt/anuncio/'+x['slug'],source='Imovirtual',origin='external',status='Active',desc=x.get('shortDescription') or address,observedAt=time.time(),**map_location(x.get('location'))))
 return out,search.get('pagination',{}).get('totalPages',1)

def parse_idealista(raw,city):
 out=[]
 for card in re.findall(r'<article\b[^>]*data-element-id=["\'][^"\']+["\'][^>]*>.*?</article>',raw,re.S):
  link=re.search(r'<a\b[^>]*href=["\'](/imovel/(\d+)/)["\'][^>]*class=["\']item-link[^"\']*["\'][^>]*>(.*?)</a>',card,re.S)
  pm=re.search(r'<span\b[^>]*class=["\']item-price[^"\']*["\'][^>]*>([^<]+)',card)
  if not link or not pm:continue
  title=text(link[3]);price=number(pm[1]);details=[text(x) for x in re.findall(r'<span\b[^>]*class=["\']item-detail["\'][^>]*>(.*?)</span>',card,re.S)]
  beds=re.search(r'\bT(\d+)\b',' '.join(details));area=re.search(r'([\d.,]+)\s*m²',' '.join(details));photos=re.findall(r'<img\b[^>]*src=["\'](https://img[^"\']+)["\']',card)
  if price is None or not photos:continue
  n=norm(title);typ='Moradia' if 'moradia' in n else 'Terreno' if 'terreno' in n else 'Quinta' if 'quinta' in n else 'Apartamento'
  desc=re.search(r'<div class="item-description[^>]*>(.*?)</div>',card,re.S)
  out.append(dict(id='idealista:'+link[2],title=title,city=city,address=title,type=typ,price=price,beds=int(beds[1]) if beds else (0 if typ=='Terreno' else None),size=number(area[1]) if area else None,photos=photos,img=photos[0],url='https://www.idealista.pt'+link[1],source='Idealista',origin='external',status='Active',desc=text(desc[1]) if desc else '',observedAt=time.time(),mapQuery=((re.split(r'\s(?:na|no|em)\s',title,maxsplit=1)[-1]+', '+city) if re.search(r'\s(?:na|no|em)\s',title) else city)))
 if not out:raise ValueError('Sem cartões reconhecidos; página vazia, alterada ou bloqueada')
 return out

def urls_for(f,source,page):
 city=slug(f['city']);typ=f['type'];params={}
 if source=='imovirtual':
  estate={'Apartamento':'apartamento','Moradia':'moradia','Terreno':'terreno','Quinta':'quinta'}.get(typ,'imoveis')
  if city and city not in REGIONS:raise ValueError('Localização ainda não mapeada nesta fonte')
  loc=REGIONS[city]+'/'+city if city else 'todo-o-pais'
  if f['maxPrice']:params['priceMax']=int(f['maxPrice'])
  params.update(page=page,limit=36)
  return 'https://www.imovirtual.com/pt/resultados/comprar/'+estate+'/'+loc+'?'+urlencode(params)
 if typ in ('Terreno','Quinta'):raise ValueError('Tipo ainda não suportado nesta fonte')
 if not city:raise ValueError('Escolhe uma cidade para consultar esta fonte')
 suffix='' if page==1 else 'pagina-'+str(page)
 # Price filter is applied locally. Avoid restricted sorting endpoints.
 return 'https://www.idealista.pt/comprar-casas/'+city+'/'+suffix

def matches(x,f):
 if f['maxPrice'] and x['price']>f['maxPrice']:return False
 if f['beds'] and (x['beds'] is None or x['beds']<f['beds']):return False
 if f['type']!='Todos' and x['type']!=f['type']:return False
 if f['city'] and norm(f['city']) not in norm(x['city']) and norm(f['city']) not in norm(x.get('address','')):return False
 return True

def collect_source(source,f):
 result=[];errors=[]
 plan=[(f,page) for page in range(1,4)]
 if source=='imovirtual' and f['type']=='Todos':
  plan=[(dict(f,type='Apartamento'),1),(dict(f,type='Moradia'),1),(dict(f,type='Apartamento'),2)]
 for query,page in plan:
  try:
   raw=fetch(urls_for(query,source,page))
   if source=='imovirtual':items,pages=parse_imovirtual(raw)
   else:items=parse_idealista(raw,f['city']);pages=3
   result.extend(items)
   if page>=pages and not (source=='imovirtual' and f['type']=='Todos'):break
   time.sleep(1)
  except Exception as e:
   errors.append(str(e));break
 return result,errors

def key_for(f):return json.dumps(f,sort_keys=True)
def collect(f):
 result=[];sources=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
  jobs={ex.submit(collect_source,s,f):s for s in ['imovirtual','idealista']}
  for future in concurrent.futures.as_completed(jobs):
   name=jobs[future]
   try:items,errors=future.result()
   except Exception as e:items,errors=[],[str(e)]
   sources.append(dict(name=name,received=len(items),errors=errors));result.extend(items)
 # Only exact source IDs/URLs are deduped. Similar homes are not silently merged.
 seen=set();result=[x for x in result if matches(x,f) and not (x['url'] in seen or seen.add(x['url']))]
 body=dict(listings=result,sync=dict(last_sync=time.time(),sources=sources,errors=[s['name']+': '+e for s in sources for e in s['errors']],limited=True,pagesPerSource=3),searching=False)
 with LOCK:
  CACHE[key_for(f)]=(time.time(),body);TASKS.pop(key_for(f),None)
  if len(CACHE)>64:
   oldest=min(CACHE,key=lambda k:CACHE[k][0]);CACHE.pop(oldest);INTEREST.pop(oldest,None)
 return body

def request_results(f):
 k=key_for(f)
 with LOCK:
  INTEREST[k]=time.time()
  cached=CACHE.get(k)
  if cached and time.time()-cached[0]<TTL:return cached[1]
  if k not in TASKS:
   if len(TASKS)>=4:return dict(listings=[],searching=False,sync=dict(errors=['Servidor ocupado; tenta novamente'],sources=[]))
   TASKS[k]=True;threading.Thread(target=collect,args=(f,),daemon=True).start()
  body=dict(cached[1]) if cached else dict(listings=[],sync=dict(errors=[],sources=[]))
  body['searching']=True;return body

class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  from urllib.parse import parse_qs
  u=urlsplit(self.path)
  if u.path in ('/','/index.html'):
   raw=(ROOT/'index.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(raw);return
  if u.path=='/health':
   self.send_response(200);self.end_headers();self.wfile.write(b'OK');return
  if u.path!='/api/listings':self.send_error(404);return
  q=parse_qs(u.query);get=lambda k,d='':q.get(k,[d])[0]
  try:
   f=dict(city=get('city').strip()[:100],maxPrice=float(get('maxPrice') or 0),beds=int(get('beds') or 0),type=get('type','Todos'))
   if not math.isfinite(f['maxPrice']) or f['maxPrice']<0 or not 0<=f['beds']<=30:raise ValueError()
   if f['type'] not in ('Todos','Apartamento','Moradia','Terreno','Quinta','Estúdio'):raise ValueError()
  except ValueError:self.send_error(400,'Filtros invalidos');return
  raw=json.dumps(request_results(f),ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)

def maintain():
 while True:
  time.sleep(30)
  with LOCK:active=[json.loads(k) for k,(t,b) in CACHE.items() if time.time()-t>TTL and time.time()-INTEREST.get(k,0)<900]
  for f in active:request_results(f)

if __name__=='__main__':
 try:
  seed=json.loads((ROOT/'primeira_pesquisa.json').read_text())
  seed_filter=dict(city='Braga',maxPrice=250000.0,beds=2,type='Apartamento')
  CACHE[key_for(seed_filter)]=(seed['sync']['last_sync'],seed)
 except (OSError,ValueError,KeyError):pass
 threading.Thread(target=maintain,daemon=True).start()
 print('Homezee: http://localhost:8080 — abre este endereço no browser',flush=True)
 ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('COLLECTOR_PORT','8090'))),Handler).serve_forever()
