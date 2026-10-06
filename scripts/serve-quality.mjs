// Изолированная приёмка production-сборки; рабочие данные не изменяются.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist');
const port = Number(process.argv[2] ?? 4175);
const empty = { schemaVersion: 1, editions: [], teams: [], players: [], participations: [] };
const probe = `
const started = performance.now();
const metrics = [];
const publish = () => { document.documentElement.dataset.qaMetrics = JSON.stringify(metrics); };
const requests = [];
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) if (entry.initiatorType === 'fetch') requests.push(new URL(entry.name).pathname);
  document.documentElement.dataset.qaRequests = JSON.stringify(requests);
}).observe({type:'resource', buffered:true});
for (const type of ['click', 'keydown', 'change']) {
  window.addEventListener(type, event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('#workspace')) return;
    const start = performance.now();
    const label = target.getAttribute('data-participation-id') || target.getAttribute('data-player-id') || target.id || target.textContent?.slice(0, 50);
    setTimeout(() => {
      metrics.push({type, target:label, ms:+(performance.now()-start).toFixed(2)});
      publish();
    }, 0);
  }, true);
}
const observer = new MutationObserver(() => {
  if ((document.querySelector('#workspace') && !document.querySelector('#workspace').hidden) || document.querySelector('#load-status')?.classList.contains('error') || document.querySelector('#load-status')?.textContent === 'Пока нет результатов турнира.') {
    metrics.push({type:'initial-render', ms:+(performance.now()-started).toFixed(2)});
    publish(); observer.disconnect();
  }
});
observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class']});
`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const match = url.pathname.match(/^\/(full|empty|error)(\/.*)?$/);
  if (!match) { response.writeHead(404); response.end('Используйте /full/, /empty/ или /error/.'); return; }
  const [, mode, suffix = '/'] = match;
  if (suffix === '/qa-probe.js') { response.setHeader('Content-Type', mime['.js']); response.end(probe); return; }
  if (/^\/data\/[^/]+\/history\.json$/.test(suffix) && mode !== 'full') {
    response.writeHead(mode === 'error' ? 503 : 200, { 'Content-Type': mime['.json'] });
    response.end(mode === 'empty' ? JSON.stringify(empty) : 'Техническая ошибка тестового сервера'); return;
  }
  if (!extname(suffix) && !suffix.endsWith('/')) {
    response.writeHead(302, { Location: url.pathname + '/' + url.search }); response.end(); return;
  }
  const file = resolve(root, '.' + (suffix.endsWith('/') ? suffix + 'index.html' : suffix));
  if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
  try {
    let body = await readFile(file);
    if (extname(file) === '.html') {
      body = Buffer.from(body.toString().replace('<head>', `<head><script src="/${mode}/qa-probe.js"></script>`));
    }
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(body);
  } catch { response.writeHead(404); response.end('Файл не найден'); }
}).listen(port, '127.0.0.1', () => console.log(`Приёмка: http://127.0.0.1:${port}/full/chr/ (/empty/chr/, /error/chr/). Только локальный интерфейс.`));
