// Headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9341;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?test=1';
let failures = 0;
const pageErrors = [];
function check(name, cond, extra) {
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await wait(200);
  }
  return false;
}

(async () => {
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/simon-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(JSON.stringify(msg.params.args));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };

  check('page title contains Presentation', (await ev('document.title'))?.includes('Presentation'));
  check('clock renders', (await ev(`document.getElementById('clockBig').textContent`)) === '10:00');
  check('5 presets render', (await ev(`document.querySelectorAll('.preset').length`)) === 5);
  check('start button visible', (await ev(`!!document.getElementById('startBtn')`)) === true);

  // Validation: empty title blocks start.
  await ev(`document.getElementById('titleInput').value=''`);
  await ev(`document.getElementById('startBtn').click()`);
  await wait(300);
  check('empty title shows inline error', (await ev(`document.getElementById('titleError').textContent`)) !== '');
  check('timer did not start with empty title', (await ev(`window.__pt.getState().running`)) === false);

  // Valid talk: 10 min, advance to phase boundaries.
  await ev(`document.getElementById('titleInput').value='Demo talk'`);
  await ev(`document.getElementById('startBtn').click()`);
  check('timer running after start', await poll(async () =>
    (await ev(`window.__pt.getState().running`)) === true, 3000, 'running'));
  await ev(`window.__pt.advance(449)`);
  check('449s is green', (await ev(`window.__pt.getState().phase`)) === 'green');
  await ev(`window.__pt.advance(1)`);
  check('450s is amber', (await ev(`window.__pt.getState().phase`)) === 'amber');
  check('badge shows amber text', (await ev(`document.getElementById('phaseBadge').textContent`)).includes('Amber'));
  await ev(`window.__pt.advance(90)`);
  check('540s is red', (await ev(`window.__pt.getState().phase`)) === 'red');
  await ev(`window.__pt.advance(61)`);
  check('601s is overtime', (await ev(`window.__pt.getState().phase`)) === 'overtime');
  check('overtime clock shows + sign', (await ev(`document.getElementById('clockBig').textContent`)).startsWith('+'));

  // Pause, then finish & log: planned 10:00, actual 10:01 -> +00:01 over.
  await ev(`window.__pt.pause()`);
  check('paused', (await ev(`window.__pt.getState().running`)) === false);
  await ev(`window.__pt.finish()`);
  check('log has 1 entry', (await ev(`window.__pt.getState().logCount`)) === 1);
  check('log row shows 00:01 over', (await ev(`document.getElementById('logBody').textContent`)).includes('00:01'), await ev(`document.getElementById('logBody').textContent`));
  check('timer reset after finish', (await ev(`window.__pt.getState().elapsedSec`)) === 0);
  check('log persists in localStorage', typeof (await ev(`localStorage.getItem('presentation-timer-bd-log')`)) === 'string');

  // Language toggle + Bengali digits.
  await ev(`document.getElementById('langBtn').click()`);
  check('html lang switches to bn', (await ev(`document.documentElement.lang`)) === 'bn');
  check('lang button now reads English', (await ev(`document.getElementById('langBtn').textContent`)) === 'English');
  check('clock uses Bengali digits after toggle', /[\u09e6-\u09ef]/.test(String(await ev(`document.getElementById('clockBig').textContent`))), String(await ev(`document.getElementById('clockBig').textContent`)));

  // 390px mobile check via emulation.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(600);
  const overflow = await ev(`document.documentElement.scrollWidth > 390 + 5`);
  check('390px viewport: no horizontal overflow', overflow === false, 'scrollWidth exceeded');
  check('no page console/exception errors', pageErrors.length === 0, pageErrors.join(' | '));

  ws.close(); chrome.kill();
  console.log(failures === 0 ? 'SMOKE GREEN' : 'SMOKE FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('SMOKE HARNESS ERROR', e); process.exit(2); });
