from http.server import BaseHTTPRequestHandler,HTTPServer
import json
class H(BaseHTTPRequestHandler):
 def do_GET(self):
  b=json.dumps({'searching':False,'sync':{'errors':[]},'listings':[{'title':'Apartamento T2 de teste externo','city':'Braga','address':'Braga, Portugal','type':'Apartamento','price':225000,'beds':2,'size':90,'photos':['/listings/01a.jpg'],'url':'https://www.imovirtual.com/pt/anuncio/homezee-fixture','source':'Imovirtual','desc':'Anúncio simulado apenas para verificar a integração.','mapQuery':'Braga, Portugal'}]}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b)
HTTPServer(('127.0.0.1',8090),H).serve_forever()
