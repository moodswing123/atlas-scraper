import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validatePublicUrl, isPublicIp, redactHeaders } from '../src/scraper/safety.js';
import { extractHtml } from '../src/scraper/extract.js';
import { Store } from '../src/store/store.js';
import { exportJob } from '../src/exports/report.js';
import { execFileSync } from 'node:child_process';
import { escapeHtml, renderPanel, keyValue, homeMessage } from '../src/bot/messages.js';
import { buildKeyboard } from '../src/bot/bot.js';

test('renders branded panels and escapes untrusted HTML values',()=>{
 const panel=renderPanel('<TITLE>','<b>Details</b>');
 assert.match(panel,/<b>◆ ATLAS SCRAPER<\/b>/);assert.match(panel,/<i>PUBLIC WEBSITE INTELLIGENCE<\/i>/);assert.match(panel,/&lt;TITLE&gt;/);assert.ok(keyValue('Target','<script>').includes('&lt;script&gt;'));assert.equal(escapeHtml(`a&b"c'`),'a&amp;b&quot;c&#39;');
});
test('home overview uses readable labeled account rows',()=>{
 const text=homeMessage({userId:'42',scans:3,pageLimit:20,depthLimit:2});assert.match(text,/<b>ACCOUNT OVERVIEW<\/b>/);assert.match(text,/Telegram ID/);assert.match(text,/Scans saved/);assert.match(text,/Pages per scan/);assert.match(text,/Maximum depth/);
});
test('inline keyboards preserve button groups and use supported style values',()=>{
 const keyboard=buildKeyboard([[['Start scan','atlas:run:abc123'],['Cancel','atlas:cancel:abc123']],[['Download ZIP','atlas:zip:abc123']]]).inline_keyboard;
 assert.equal(keyboard.length,2);assert.equal(keyboard[0].length,2);assert.equal(keyboard[0][0].style,'success');assert.equal(keyboard[0][1].style,'danger');assert.equal(keyboard[1][0].style,'success');
 for(const row of keyboard)for(const button of row){assert.ok(['primary','success','danger'].includes(button.style));if(button.callback_data)assert.ok(Buffer.byteLength(button.callback_data,'utf8')<=64);}
});

test('rejects unsupported schemes, credentials, localhost, private IPv4 and IPv6', async()=>{
 for(const u of ['file:///etc/passwd','http://user:pw@example.com','http://localhost/','http://127.0.0.1/','http://10.0.0.1/','http://[::1]/','http://169.254.169.254/latest/meta-data']) await assert.rejects(validatePublicUrl(u));
});
test('allows only public unicast IP address ranges',()=>{assert.equal(isPublicIp('127.0.0.1'),false);assert.equal(isPublicIp('10.10.1.1'),false);assert.equal(isPublicIp('169.254.1.2'),false);assert.equal(isPublicIp('8.8.8.8'),true);});
test('redacts authentication and cookie response headers',()=>{const h=redactHeaders({authorization:'secret',cookie:'session=abc','content-type':'text/html'});assert.equal(h.authorization,'[REDACTED]');assert.equal(h.cookie,'[REDACTED]');assert.equal(h['content-type'],'text/html');});
test('extracts content, metadata, JSON-LD, links, images and form metadata without submitting data',()=>{
 const html='<html lang="en"><head><title>Safe title</title><meta name="description" content="Desc"><link rel="canonical" href="/canonical"><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><h1>Heading</h1><p>hello</p><a href="/next">Next</a><a href="https://elsewhere.example/x">External</a><img src="/x.png"><form action="/submit"><input name="email" type="email"></form></body></html>';
 const x=extractHtml(html,'https://example.com/');assert.equal(x.title,'Safe title');assert.equal(x.canonical,'https://example.com/canonical');assert.equal(x.jsonLd[0]['@type'],'WebPage');assert.equal(x.links[0].kind,'internal');assert.equal(x.links[1].kind,'external');assert.equal(x.images[0].url,'https://example.com/x.png');assert.equal(x.forms[0].fields[0].name,'email');assert.match(x.text,/hello/);assert.doesNotMatch(x.text,/email/);
});
test('persists user-owned jobs and refuses cross-user access',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-'));const store=await new Store(path.join(dir,'state.json')).init();const j=await store.addJob({userId:'1',target:'https://example.com',status:'completed'});assert.ok(store.ownedJob(j.id,'1'));assert.equal(store.ownedJob(j.id,'2'),null);await store.deleteUserData('1');assert.equal(store.state.jobs[j.id],undefined);await fs.rm(dir,{recursive:true,force:true});});
test('exports offline report, structured JSON, CSV and valid ZIP without traversable job paths',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-export-'));const result={target:'https://example.com',startedAt:'2026-01-01T00:00:00.000Z',finishedAt:'2026-01-01T00:00:02.000Z',durationMs:2000,requestCount:1,pages:[{url:'https://example.com/',finalUrl:'https://example.com/',status:200,depth:0,title:'<script>alert(1)</script>',description:'Demo',canonical:null,meta:{},jsonLd:[],headings:{h1:['Welcome']},text:'Safe demo text',links:[],images:[],resources:[],robots:null}],errors:[],headers:[],robotsText:'User-agent: *',sitemapUrls:[]};
 const out=await exportJob(result,root,'../../unsafe name');assert.ok(out.html.startsWith(root));assert.ok((await fs.readFile(out.html,'utf8')).includes('SCAN REPORT'));assert.ok((await fs.readFile(path.join(path.dirname(out.html),'data/pages.json'),'utf8')).includes('Safe demo text'));assert.ok((await fs.readFile(path.join(path.dirname(out.html),'tables/pages.csv'),'utf8')).includes('title'));assert.match(await fs.readFile(out.html,'utf8'),/\\u003cscript\\u003e/);execFileSync('unzip',['-t',out.zip],{stdio:'pipe'});const names=execFileSync('unzip',['-Z1',out.zip],{encoding:'utf8'});assert.match(names,/manifest.json/);assert.match(names,/index.html/);await fs.rm(root,{recursive:true,force:true});});
