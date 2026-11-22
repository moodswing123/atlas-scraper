import dns from 'node:dns/promises';
import https from 'node:https';
import http from 'node:http';
import ipaddr from 'ipaddr.js';

const BLOCKED_PATH = /(?:^|\/)(?:logout|log-out|delete|remove|purchase|checkout|cart|account|signin|sign-in|login|password|unsubscribe)(?:\/|$)/i;
export const SENSITIVE_HEADERS = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i;

export function isPublicIp(address) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export async function validatePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Enter a valid absolute URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  const allowedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== allowedPort) throw new Error('Only the standard port for the selected HTTP/HTTPS protocol is allowed.');
  if (BLOCKED_PATH.test(url.pathname)) throw new Error('This URL resembles an account or state-changing action and was excluded.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.')) throw new Error('Local and internal hostnames are not allowed.');
  const answers = ipaddr.isValid(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!answers.length) throw new Error('The host could not be resolved.');
  if (answers.some(record => !isPublicIp(record.address))) throw new Error('The host resolves to a non-public IP address and is blocked.');
  return url;
}

function requestOnce(url, { timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      headers: { 'user-agent': 'AtlasScraper/1.0 (+respectful public research crawler)', accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.8,*/*;q=0.1' },
      timeout: timeoutMs,
      maxHeaderSize: 16 * 1024,
      lookup(host, options, callback) {
        dns.lookup(host, { all: true, verbatim: true }).then(records => {
          if (!records.length || records.some(item => !isPublicIp(item.address))) return callback(new Error('Unsafe DNS result blocked.'));
          if (options?.all) callback(null, records);
          else callback(null, records[0].address, records[0].family);
        }).catch(callback);
      }
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { req.destroy(new Error('Response exceeded the configured size limit.')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), location: res.headers.location ?? null }));
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out.')));
    req.on('error', reject);
    req.end();
  });
}

export async function safeGet(input, limits = {}) {
  const options = { timeoutMs: limits.timeoutMs ?? 12000, maxBytes: limits.maxBytes ?? 2_000_000 };
  let url = await validatePublicUrl(input);
  const redirects = [];
  for (let i = 0; i <= 5; i++) {
    const result = await requestOnce(url, options);
    if (![301, 302, 303, 307, 308].includes(result.status) || !result.location) {
      return { ...result, url: url.href, redirects };
    }
    if (i === 5) throw new Error('Redirect limit exceeded.');
    redirects.push({ from: url.href, status: result.status, to: new URL(result.location, url).href });
    url = await validatePublicUrl(new URL(result.location, url).href);
  }
  throw new Error('Redirect limit exceeded.');
}

export function redactHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, SENSITIVE_HEADERS.test(key) ? '[REDACTED]' : String(value).slice(0, 1000)]));
}
