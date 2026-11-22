import { createHash } from 'node:crypto';
import { safeGet, validatePublicUrl, redactHeaders } from './safety.js';
import { extractHtml } from './extract.js';

const EXCLUDED = /(?:logout|log-out|delete|remove|purchase|checkout|cart|account|login|signin|unsubscribe)(?:\/|$)/i;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function crawl(startUrl, options = {}, hooks = {}) {
  const cfg = { maxPages: Math.min(options.maxPages ?? 10, 250), maxDepth: Math.min(options.maxDepth ?? 1, 8), maxRuntimeMs: options.maxRuntimeMs ?? 120000, maxPageBytes: options.maxPageBytes ?? 2_000_000, timeoutMs: options.timeoutMs ?? 12000, delayMs: options.delayMs ?? 1000, obeyRobots: options.obeyRobots !== false };
  const start = await validatePublicUrl(startUrl); const origin = start.origin; const began = Date.now();
  const queue = [{ url: start.href, depth: 0 }], seen = new Set(), pages = [], errors = [], headers = [];
  let robotsText = '', allowedPaths = ['/'], sitemapUrls = []; let paused = false, canceled = false, requestCount = 0;
  const state = { pause: () => { paused = true; }, resume: () => { paused = false; }, cancel: () => { canceled = true; paused = false; } };
  hooks.onControl?.(state);
  const emit = event => hooks.onProgress?.({ ...event, pages: pages.length, queued: queue.length, errors: errors.length, requestCount, elapsedMs: Date.now() - began });
  try {
    const robotsUrl = new URL('/robots.txt', origin).href;
    const r = await safeGet(robotsUrl, cfg); requestCount++;
    if (r.status < 400 && r.status !== 0) {
      robotsText = r.body.toString('utf8').slice(0, 100000);
      let relevant = false;
      for (const line of robotsText.split(/\r?\n/)) {
        const [rawKey, ...rest] = line.split(':'); const key = rawKey?.trim().toLowerCase(); const value = rest.join(':').trim();
        if (key === 'user-agent') relevant = value === '*' || /atlas|bot/i.test(value);
        if (relevant && key === 'disallow' && value) allowedPaths.push(`!${value}`);
        if (key === 'sitemap' && value) { try { sitemapUrls.push((await validatePublicUrl(value)).href); } catch {} }
      }
    }
  } catch (e) { errors.push({ url: new URL('/robots.txt', origin).href, message: `robots.txt unavailable: ${e.message}` }); }
  const disallowed = path => allowedPaths.some(v => v.startsWith('!') && (path === v.slice(1) || path.startsWith(v.slice(1))));
  if (cfg.obeyRobots && disallowed(start.pathname)) return { jobId: options.jobId, target: origin, pages, errors: [{ url: start.href, message: 'Disallowed by robots.txt.' }], headers, robotsText, sitemapUrls, startedAt: new Date(began).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - began, requestCount, canceled: false };
  for (const siteMap of sitemapUrls.slice(0, 3)) {
    try { const res = await safeGet(siteMap, cfg); requestCount++; if (res.status < 400) { const xml = res.body.toString('utf8'); for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) { try { const u = await validatePublicUrl(match[1].trim()); if (u.origin === origin && !EXCLUDED.test(u.pathname)) queue.push({ url: u.href, depth: 0 }); } catch {} } } } catch (e) { errors.push({ url: siteMap, message: e.message }); }
  }
  emit({ phase: 'crawl-started', currentUrl: start.href });
  while (queue.length && pages.length < cfg.maxPages && Date.now() - began < cfg.maxRuntimeMs && !canceled) {
    while (paused && !canceled) { await sleep(200); }
    if (canceled) break;
    const item = queue.shift();
    let checked; try { checked = await validatePublicUrl(item.url); } catch (e) { errors.push({ url: item.url, message: e.message }); continue; }
    checked.hash = ''; const url = checked.href;
    if (seen.has(url) || checked.origin !== origin || EXCLUDED.test(checked.pathname)) continue;
    seen.add(url); emit({ phase: 'downloading', currentUrl: url });
    const before = Date.now();
    try {
      const response = await safeGet(url, cfg); requestCount++;
      const headersSafe = redactHeaders(response.headers); headers.push({ url, status: response.status, headers: headersSafe, redirects: response.redirects, contentType: response.headers['content-type'] || null, responseTimeMs: Date.now() - before });
      if (response.status === 403 || response.status === 429) { errors.push({ url, message: `Access stopped by site (HTTP ${response.status}); no evasion attempted.` }); emit({ phase: 'blocked', currentUrl: url, status: response.status }); continue; }
      if (response.status < 200 || response.status >= 300) { errors.push({ url, message: `HTTP ${response.status}` }); continue; }
      const ctype = response.headers['content-type'] || '';
      if (!/text\/html|application\/xhtml\+xml/i.test(ctype)) { errors.push({ url, message: `Skipped non-HTML response (${ctype || 'unknown content type'}).` }); continue; }
      const page = extractHtml(response.body.toString('utf8'), url, { ...response, responseTimeMs: Date.now() - before });
      page.depth = item.depth; page.headers = headersSafe; page.textHash = createHash('sha256').update(page.text).digest('hex'); pages.push(page);
      if (item.depth < cfg.maxDepth) for (const link of page.links) {
        try { const child = await validatePublicUrl(link.url); child.hash = ''; if (child.origin === origin && !seen.has(child.href) && !EXCLUDED.test(child.pathname) && !(cfg.obeyRobots && disallowed(child.pathname))) queue.push({ url: child.href, depth: item.depth + 1 }); } catch {}
      }
      emit({ phase: 'parsed', currentUrl: url, status: response.status, activity: `Extracted ${page.links.length} links, ${page.images.length} images` });
    } catch (e) { errors.push({ url, message: e.message }); emit({ phase: 'request-error', currentUrl: url }); }
    if (cfg.delayMs) await sleep(cfg.delayMs);
  }
  return { jobId: options.jobId, target: origin, pages, errors, headers, robotsText, sitemapUrls, startedAt: new Date(began).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - began, requestCount, canceled, config: cfg };
}
