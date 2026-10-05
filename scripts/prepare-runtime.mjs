// Nitro bundles the PGLite JS but its WASM/data must remain beside that bundle.
import {copyFileSync,existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
if(process.env.HOMEZEE_TARGET==='node'){
 const target='.output/server/_libs';mkdirSync(target,{recursive:true});
 for(const name of ['pglite.data','pglite.wasm','initdb.wasm']){const from=`node_modules/@electric-sql/pglite/dist/${name}`;if(!existsSync(from))throw new Error(`Missing PGLite runtime: ${name}`);copyFileSync(from,`${target}/${name}`);}
}

// Tailwind's SSR CSS URL can differ from the client asset hash. Point the
// server document at the actual emitted stylesheet rather than a missing file.
if(process.env.HOMEZEE_TARGET==='node'){
 const assets='.output/public/assets';const css=readdirSync(assets).find(n=>/^styles-.*\.css$/.test(n));
 if(!css)throw new Error('Missing app stylesheet');
 for(const name of readdirSync('.output/server/_ssr')){if(!name.endsWith('.mjs'))continue;const path=`.output/server/_ssr/${name}`;const source=readFileSync(path,'utf8');const updated=source.replace(/\/assets\/styles-[A-Za-z0-9_-]+\.css/g,`/assets/${css}`);if(updated!==source)writeFileSync(path,updated);}
}
