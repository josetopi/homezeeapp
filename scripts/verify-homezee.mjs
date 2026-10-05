// Integration verification: real email account, feed, map, favorite and native visit.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const root=process.cwd();mkdirSync('/workspace/screenshots',{recursive:true});
const env={...process.env,PORT:'8080',HOST:'0.0.0.0',HOMEZEE_DEMO:'true',HOMEZEE_TARGET:'node',NO_PROXY:'localhost,127.0.0.1'};
const mode=process.env.QA_MODE || 'dev';
const app=spawn(mode==='dev'?'npm':'node',mode==='dev'?['run','dev']:['.output/server/index.mjs'],{env,stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',b=>logs+=b);app.stderr.on('data',b=>logs+=b);
const collector=spawn('python3',[process.env.QA_EXTERNAL ? 'scripts/fixtures/portal.py' : 'portal_collector.py'],{env,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:8080/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME_PATH,proxy:process.env.QA_USE_PROXY && process.env.HTTPS_PROXY ? {server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'} : undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const errors=[];const page=await browser.newPage({ignoreHTTPSErrors:Boolean(process.env.QA_USE_PROXY),viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER:',m.text())});page.on('response',r=>{if(r.status()>=400)console.error('HTTP:',r.status(),r.url())});page.on('requestfailed',r=>console.error('REQUEST:',r.url(),r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8080/login',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'És novo? Cria uma conta'}).click();
 await page.locator('#name').fill('Teste Homezee');await page.locator('#email').fill(`homezee-${Date.now()}@example.com`);await page.locator('#password').fill('TestOnly-Homezee-2026');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.waitForURL('**/onboarding',{timeout:60000,waitUntil:'domcontentloaded'});
 await page.locator('#n').fill('Teste Homezee');
 await page.getByRole('button',{name:'Descobrir casas'}).click();
 await page.waitForURL('**/discover');
 await page.getByRole('button',{name:'Guardar',exact:true}).waitFor({timeout:20000});
 await page.screenshot({path:`/workspace/screenshots/homezee-${mode}-mobile.png`});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await page.getByRole('button',{name:'Ver mapa',exact:true}).last().click();
 const iframe=page.locator('iframe[title^="Mapa de"]').last();await iframe.waitFor();const before=await iframe.getAttribute('src');
 await page.getByRole('button',{name:'Aproximar mapa'}).click();if(await iframe.getAttribute('src')===before)throw Error('Map zoom did not change');
 await page.getByRole('button',{name:'Afastar mapa'}).click();if(await iframe.getAttribute('src')!==before)throw Error('Map zoom out did not restore');
 await page.screenshot({path:`/workspace/screenshots/homezee-${mode}-map.png`});
 await page.getByRole('button',{name:'‹ Fotografias'}).click();
 await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await page.waitForTimeout(600);await page.getByRole('link',{name:'Guardados',exact:true}).click();
 await page.locator('button').filter({has:page.locator('img')}).first().click();
 await page.getByRole('button',{name:'Pedir visita',exact:true}).click();
 await page.waitForURL('**/visits');await page.getByText(/slots proposed|horários propostos/i).first().waitFor({timeout:10000});
 const visitText=await page.locator('body').innerText();if(!/slots proposed|confirmed|horários propostos/i.test(visitText))throw Error('Native visit missing');
 await page.getByRole('link',{name:'Discover',exact:true}).click();await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.locator('#loc').fill('Braga');await page.getByRole('button',{name:'Aplicar filtros'}).click();
 await page.waitForTimeout(3000);await page.setViewportSize({width:1280,height:800});await page.screenshot({path:`/workspace/screenshots/homezee-${mode}-desktop.png`});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(process.env.QA_EXTERNAL ? 1200 : 20000);
 if(process.env.QA_EXTERNAL){
   for(let i=0;i<24 && (await page.locator('[data-active-listing]').getAttribute('data-active-listing')) !== 'Apartamento T2 de teste externo';i++){await page.getByRole('button',{name:'Passar',exact:true}).click();await page.waitForTimeout(600);}
   await page.getByText('Apartamento T2 de teste externo',{exact:true}).last().waitFor();
   await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.waitForTimeout(700);await page.getByRole('link',{name:'Guardados',exact:true}).click();
   await page.getByRole('button').filter({hasText:'Apartamento T2 de teste externo'}).click();
   if(await page.getByRole('button',{name:'Mensagem',exact:true}).count())throw Error('External listing incorrectly allows internal chat');
   await page.context().route('https://www.imovirtual.com/**',r=>r.fulfill({body:'Test original portal redirect',contentType:'text/html'}));
   const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Pedir visita no Imovirtual'}).click();const popup=await popupPromise;await popup.waitForLoadState();if(!popup.url().includes('homezee-fixture'))throw Error('Wrong external redirect');await popup.close();
   await page.getByRole('link',{name:'Visitas',exact:true}).click();if((await page.locator('body').innerText()).includes('Apartamento T2 de teste externo'))throw Error('External visit leaked to native scheduler');
 }

 const text=await page.locator('body').innerText();
 await page.screenshot({path:`/workspace/screenshots/homezee-${mode}-portals.png`});
 writeFileSync(`/workspace/screenshots/homezee-${mode}-verdict.json`,JSON.stringify({ok:errors.length===0,errors,checks:['account signup','onboarding without mandatory filters','native feed','map last page','zoom in/out','native favorite','native visit','Braga portal polling','mobile no overflow'],portalStatus:text},null,2));
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({ok:true,mode,portalStatus:text.slice(0,1800)}));
 await new Promise((resolve,reject)=>{const smoke=spawn('node',['scripts/browser-smoke.mjs','http://127.0.0.1:8080/',`/workspace/screenshots/homezee-${mode}-smoke.png`],{env:{...env,QA_CHROME_PATH:process.env.QA_CHROME_PATH},stdio:'inherit'});smoke.on('exit',code=>code?reject(new Error('Smoke check failed')):resolve());});
} catch(e){console.error(e);console.error(logs.slice(-3000));if(browser){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0]){console.error((await pages[0].locator('body').innerText()).slice(0,2500));await pages[0].screenshot({path:'/workspace/screenshots/homezee-failure.png'});}}process.exitCode=1;}
finally{await browser?.close();app.kill('SIGTERM');collector.kill('SIGTERM');}
