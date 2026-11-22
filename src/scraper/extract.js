import { load } from 'cheerio';

function absolute(raw, base) {
  if (!raw) return null;
  try { const u = new URL(raw, base); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}

export function extractHtml(html, pageUrl, response = {}) {
  const $ = load(html, { xmlMode: false });
  const title = $('title').first().text().trim();
  const meta = {};
  $('meta').each((_, el) => { const key = ($(el).attr('property') || $(el).attr('name') || $(el).attr('http-equiv') || '').trim().toLowerCase(); const value = ($(el).attr('content') || '').trim(); if (key && value) meta[key] = value.slice(0, 4000); });
  const canonical = absolute($('link[rel="canonical"]').first().attr('href'), pageUrl);
  const headings = {};
  for (let i = 1; i <= 6; i++) headings[`h${i}`] = $(`h${i}`).map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 100);
  const links = $('a[href]').map((_, el) => ({ url: absolute($(el).attr('href'), pageUrl), text: $(el).text().trim().slice(0, 500), rel: $(el).attr('rel') || '' })).get().filter(x => x.url);
  const images = $('img').map((_, el) => ({ url: absolute($(el).attr('src') || $(el).attr('data-src'), pageUrl), alt: $(el).attr('alt') ?? null, width: $(el).attr('width') ?? null, height: $(el).attr('height') ?? null })).get().filter(x => x.url);
  const resources = [];
  $('script[src],link[rel="stylesheet"],link[rel="icon"],link[rel="manifest"],link[as="font"]').each((_, el) => {
    const raw = $(el).attr('src') || $(el).attr('href'); const url = absolute(raw, pageUrl);
    if (url) resources.push({ url, type: el.tagName === 'script' ? 'script' : ($(el).attr('as') || $(el).attr('rel') || 'resource') });
  });
  const jsonLd = $('script[type="application/ld+json"]').map((_, el) => { try { return JSON.parse($(el).contents().text()); } catch { return null; } }).get().filter(Boolean);
  const forms = $('form').map((_, el) => ({ method: ($(el).attr('method') || 'GET').toUpperCase(), action: absolute($(el).attr('action') || pageUrl, pageUrl), fields: $(el).find('input,select,textarea,button').map((__, field) => ({ name: $(field).attr('name') || '', type: $(field).attr('type') || field.tagName })).get().slice(0, 100) })).get();
  $('script,style,noscript,svg,iframe,nav,footer,header,form').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20000);
  const origin = new URL(pageUrl).origin;
  return {
    url: pageUrl, finalUrl: response.url || pageUrl, status: response.status ?? null, contentType: response.headers?.['content-type'] || null,
    responseTimeMs: response.responseTimeMs ?? null, redirects: response.redirects || [], title: title.slice(0, 1000),
    description: meta.description || meta['og:description'] || '', language: $('html').attr('lang') || null, canonical,
    headings, text, paragraphs: $('p').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 300),
    meta, openGraph: Object.fromEntries(Object.entries(meta).filter(([k]) => k.startsWith('og:'))),
    jsonLd, links: links.map(x => ({ ...x, kind: new URL(x.url).origin === origin ? 'internal' : 'external' })), images,
    resources, forms, robots: meta['robots'] || meta['googlebot'] || null
  };
}
