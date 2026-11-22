import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yazl from 'yazl';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const csv = rows => { if (!rows.length) return ''; const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; return [cols.join(','), ...rows.map(r => cols.map(c => `"${String(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n'); };
const writeJson = (dir, name, data) => fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2));

export function renderReport(result) {
  const safeData = JSON.stringify(result).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS SCRAPER — Scan report</title><style>
</style><header><small>ATLAS SCRAPER / PUBLIC WEBSITE INTELLIGENCE</small><h1>SCAN REPORT</h1><div id="target"></div><div id="sample-flag"></div></header><main><div id="cards" class="cards"></div><section><h2>Page inventory</h2><input id="search" placeholder="Filter pages by URL or title" aria-label="Filter pages"><div style="overflow:auto;margin-top:12px"><table><thead><tr><th>Page</th><th>Status</th><th>Depth</th><th>Title</th><th>Links</th></tr></thead><tbody id="pages"></tbody></table></div></section><section><h2>Technical observations</h2><p class="muted">Headers shown below were observed in public responses. Technology identity, where assessed, is an inference.</p><pre id="technical"></pre></section><section><h2>Errors and limitations</h2><ul id="errors"></ul><p class="muted">This report contains information from unauthenticated HTTP requests only. It does not access private systems, submit forms, or execute target scripts. Static parsing may omit content rendered only by client-side JavaScript. Respectful crawl limits and robots policy apply.</p></section><footer class="muted">Generated ${esc(result.finishedAt || new Date().toISOString())} · ATLAS SCRAPER 1.0.0</footer></main><script type="application/json" id="payload">${safeData}</script><script>
const d=JSON.parse(document.querySelector('#payload').textContent);document.querySelector('#target').textContent=d.target||'';if(d.jobId==='sample-demo'){const flag=document.querySelector('#sample-flag');flag.textContent='ILLUSTRATIVE SAMPLE DATA — NOT A LIVE SCAN';flag.style.cssText='margin-top:12px;padding:9px 12px;border:1px solid #8d6130;background:#291e12;color:#f2c37c;border-radius:6px;display:inline-block;font-size:12px;letter-spacing:.04em'}const counts=[['Pages',d.pages?.length||0],['Links',d.pages?.reduce((n,p)=>n+p.links.length,0)||0],['Images',d.pages?.reduce((n,p)=>n+p.images.length,0)||0],['Requests',d.requestCount||0],['Errors',d.errors?.length||0],['Duration',((d.durationMs||0)/1000).toFixed(1)+'s']];document.querySelector('#cards').innerHTML=counts.map(([x,n])=>'<div class="card"><b>'+String(n)+'</b>'+x+'</div>').join('');const tbody=document.querySelector('#pages');function draw(q=''){tbody.innerHTML=(d.pages||[]).filter(p=>(p.url+' '+p.title).toLowerCase().includes(q.toLowerCase())).map(p=>'<tr><td><a href="'+encodeURI(p.url)+'">'+escapeHtml(p.url)+'</a></td><td>'+String(p.status??'—')+'</td><td>'+p.depth+'</td><td>'+escapeHtml(p.title||'Untitled')+'</td><td>'+p.links.length+'</td></tr>').join('')}function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}draw();document.querySelector('#search').addEventListener('input',e=>draw(e.target.value));document.querySelector('#technical').textContent=JSON.stringify({responseHeaders:d.headers,robots:d.robotsText,sitemaps:d.sitemapUrls},null,2);document.querySelector('#errors').innerHTML=(d.errors||[]).map(e=>'<li>'+escapeHtml(e.url||'')+': '+escapeHtml(e.message)+'</li>').join('');
</script></html>`;
}

export async function exportJob(result, outputRoot, jobId = 'sample') {
  const safeJobId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'job';
  const dir = path.join(outputRoot, safeJobId);
  await fs.rm(dir, { recursive: true, force: true });
  for (const sub of ['data','tables','logs']) await fs.mkdir(path.join(dir, sub), { recursive: true });
  const links = (result.pages || []).flatMap(p => p.links.map(l => ({ source: p.url, ...l })));
  const images = (result.pages || []).flatMap(p => p.images.map(i => ({ source: p.url, ...i })));
  const resources = (result.pages || []).flatMap(p => p.resources.map(r => ({ source: p.url, ...r })));
  const metadata = (result.pages || []).map(p => ({ url:p.url,title:p.title,description:p.description,canonical:p.canonical,meta:p.meta,jsonLd:p.jsonLd,robots:p.robots }));
  const seo = (result.pages || []).map(p => ({url:p.url,findings:[...(p.title?[]:['Missing page title']),...(p.description?[]:['Missing meta description']),...(p.canonical?[]:[]),...p.images.filter(i=>!i.alt).map(i=>`Image missing alt: ${i.url}`),...(!p.headings.h1.length?['Missing H1']:[])]}));
  const summary = { jobId, target:result.target, startedAt:result.startedAt, finishedAt:result.finishedAt, durationMs:result.durationMs, requestCount:result.requestCount, pages:result.pages?.length||0, links:links.length, images:images.length, resources:resources.length, errors:result.errors?.length||0 };
  await Promise.all([writeJson(dir,'data/pages.json',result.pages||[]),writeJson(dir,'data/links.json',links),writeJson(dir,'data/images.json',images),writeJson(dir,'data/resources.json',resources),writeJson(dir,'data/metadata.json',metadata),writeJson(dir,'data/headers.json',result.headers||[]),writeJson(dir,'data/technical.json',{robots:result.robotsText,sitemaps:result.sitemapUrls}),writeJson(dir,'data/seo.json',seo),writeJson(dir,'data/errors.json',result.errors||[]),writeJson(dir,'data/summary.json',summary)]);
  await fs.writeFile(path.join(dir,'index.html'),renderReport(result));
  await fs.writeFile(path.join(dir,'tables/pages.csv'),csv((result.pages||[]).map(p=>({url:p.url,finalUrl:p.finalUrl,status:p.status,depth:p.depth,title:p.title,description:p.description,links:p.links.length,images:p.images.length}))));
  await fs.writeFile(path.join(dir,'tables/links.csv'),csv(links)); await fs.writeFile(path.join(dir,'tables/assets.csv'),csv([...images,...resources]));
  await fs.writeFile(path.join(dir,'logs/crawl.log'),(result.errors||[]).map(e=>`${e.url}: ${e.message}`).join('\n'));
  await fs.writeFile(path.join(dir,'README.txt'),'ATLAS SCRAPER export. index.html is an offline-friendly report. data/ contains JSON; tables/ contains CSV. Only unauthenticated public HTTP data is included.');
  const files=[]; async function walk(root, rel=''){for(const ent of await fs.readdir(root,{withFileTypes:true})){const next=path.posix.join(rel,ent.name); if(ent.isDirectory()) await walk(path.join(root,ent.name),next);else files.push(next);}} await walk(dir);
  const checksums={}; for(const name of files){checksums[name]=createHash('sha256').update(await fs.readFile(path.join(dir,name))).digest('hex');}
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({jobId,target:result.target,createdAt:new Date().toISOString(),files:checksums},null,2));
  files.push('manifest.json');
  const zip=path.join(outputRoot,`${safeJobId}.zip`); await new Promise((resolve,reject)=>{const archive=new yazl.ZipFile();const output=createWriteStream(zip);output.on('close',resolve);output.on('error',reject);archive.outputStream.on('error',reject);archive.outputStream.pipe(output);for(const name of files)archive.addFile(path.join(dir,name),name);archive.end();});
  return { dir, html:path.join(dir,'index.html'), zip };
}
