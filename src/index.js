import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Store } from './store/store.js';
import { TelegramBot } from './bot/bot.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const resolveDir=value=>path.resolve(root,value||'./data');
const token=process.env.BOT_TOKEN;
if(!token){console.error('BOT_TOKEN is required. Copy .env.example to .env and configure a token from @BotFather.');process.exit(1);}
const dataDir=resolveDir(process.env.DATA_DIR);const outputDir=resolveDir(process.env.OUTPUT_DIR||'./output');
await fs.mkdir(dataDir,{recursive:true});await fs.mkdir(outputDir,{recursive:true});
const store=await new Store(path.join(dataDir,'atlas-state.json')).init();
const limits={maxPages:bounded('MAX_PAGES',25,1,250),maxDepth:bounded('MAX_DEPTH',2,0,8),maxRuntimeMs:bounded('MAX_RUNTIME_SECONDS',180,10,1800)*1000,maxPageBytes:bounded('MAX_PAGE_BYTES',2_000_000,100_000,10_000_000),timeoutMs:bounded('REQUEST_TIMEOUT_MS',12000,1000,60000),delayMs:bounded('CRAWL_DELAY_MS',1000,500,10000),maxConcurrent:bounded('MAX_CONCURRENT_JOBS',2,1,5)};
function bounded(name,fallback,min,max){const n=Number(process.env[name]??fallback);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;}
const admins=(process.env.ADMIN_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
const bot=new TelegramBot({token,store,adminIds:admins,outputDir,limits});
const shutdown=async()=>{console.log('Shutting down.');await store.save();process.exit(0);};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
await bot.start();
