export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

const divider = '━━━━━━━━━━━━━━━━━━━━';

export function keyValue(label, value, icon = '•') {
  return `${icon} <b>${escapeHtml(label)}</b>  <code>${escapeHtml(value)}</code>`;
}

export function detailList(rows) {
  return rows.filter(Boolean).join('\n');
}

export function renderPanel(title, body = '', options = {}) {
  const subtitle = options.subtitle ?? 'PUBLIC WEBSITE INTELLIGENCE';
  const footer = options.footer ?? '';
  return `<b>◆ ATLAS SCRAPER</b>\n<i>${escapeHtml(subtitle)}</i>\n${divider}\n<b>${escapeHtml(title)}</b>${body ? `\n\n${body}` : ''}${footer ? `\n\n${divider}\n<i>${escapeHtml(footer)}</i>` : ''}`;
}

export function homeMessage({ userId, scans, pageLimit, depthLimit }) {
  const overview = [
    keyValue('Telegram ID', userId, '◉'),
    keyValue('Scans saved', scans, '▤'),
    keyValue('Pages per scan', pageLimit, '⌕'),
    keyValue('Maximum depth', depthLimit, '↳')
  ].join('\n');
  const intro = '<i>Public-site research, made clear.</i>\n\nSubmit a public URL, choose a bounded scan, and receive an offline-ready report. Only information available through ordinary unauthenticated web requests is collected.';
  const action = 'Choose an action below. Scans follow robots.txt and never submit forms or bypass access controls.';
  return renderPanel('ACCOUNT OVERVIEW', `${overview}\n\n${divider}\n${intro}\n\n${action}`, { subtitle: 'WEB INTELLIGENCE CONSOLE' });
}
