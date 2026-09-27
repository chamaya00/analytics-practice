// Photograph one URL at an exact viewport, for scripts/app-render and
// scripts/design-render.
//
//   node scripts/render-shot.mjs <browser> <url> <width> <height> <out.png> [seed-file] [dark]
//
// <dark>, if the literal string "dark", emulates prefers-color-scheme: dark
// via the DevTools protocol's Emulation.setEmulatedMedia — #126 AC3, so a
// criterion naming a dark-mode render has a command to point at rather than
// a manual OS/browser toggle nothing here can drive. Requires <seed-file> to
// be given too (pass "" to skip seeding while still setting this).
//
// <seed-file>, if given, is a path to a JS source file run in the page's own
// context before any of the page's own scripts — via the DevTools protocol's
// Page.addScriptToEvaluateOnNewDocument, not a post-navigation page.evaluate,
// because this site reads localStorage/sessionStorage at first script
// execution (which city is picked, what the cart holds) and a script wired
// in after that point would seed state the page had already read past. This
// is how app-render photographs a state (a chosen city, an added cart line)
// the built site itself has no query-string or debug hook for, without
// hand-editing a picture that isn't what the site actually produces.
//
// Why this exists: headless Chrome clamps --window-size to a minimum of 500px
// wide, so the plain `--screenshot` path asked for 375 gets a 500px viewport,
// the phone media queries (max-width: 480px) never apply, and the "narrow"
// picture is the desktop layout cropped. Measured: `innerWidth` reads 500 under
// --window-size=375,812. The DevTools protocol's device-metrics override has no
// such floor, so this drives the browser over it instead. No dependency: Node
// 22's built-in WebSocket is the whole client.

/* global process, console, setTimeout, WebSocket, Buffer -- a Node script; the repo's lint config declares no Node globals. */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [browser, url, widthArg, heightArg, out, seedFile, darkArg] = process.argv.slice(2);
if (!browser || !url || !widthArg || !heightArg || !out) {
  console.error('usage: render-shot.mjs <browser> <url> <width> <height> <out.png> [seed-file] [dark]');
  process.exit(2);
}
const seedScript = seedFile ? readFileSync(seedFile, 'utf8') : null;
const dark = darkArg === 'dark';
const width = Number(widthArg);
const height = Number(heightArg);
// A plain viewport of exactly this width, not full phone emulation: with
// `mobile: true`, a page without `<meta name="viewport">` (every self-contained
// mock in docs/design/) is laid out 980px wide and shrunk to fit, so a 375 mock
// renders as a zoomed-out desktop page. The built site declares
// width=device-width, so it lays out identically either way.
const mobile = false;
// Same settle time as the CLI path's --virtual-time-budget, so timers,
// transitions and webfonts land before the shutter.
const SETTLE_MS = 3000;

const profile = mkdtempSync(join(tmpdir(), 'render-shot-'));
const child = spawn(
  browser,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

function finish(code, message) {
  if (message) console.error(`render-shot: ${message}`);
  child.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // A profile directory left in tmp is not worth failing a picture over.
  }
  process.exit(code);
}

setTimeout(() => finish(1, `timed out photographing ${url}`), 30_000).unref();

const wsUrl = await new Promise((resolve, reject) => {
  let buffered = '';
  child.stderr.on('data', (chunk) => {
    buffered += chunk;
    const match = buffered.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) resolve(match[1]);
  });
  child.on('exit', (code) => reject(new Error(`${browser} exited (${code}) before DevTools came up`)));
}).catch((error) => finish(1, error.message));

const socket = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('could not connect to DevTools')), { once: true });
}).catch((error) => finish(1, error.message));

let nextId = 1;
const pending = new Map();
const waiters = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  for (const waiter of [...waiters]) {
    if (waiter.method === message.method && waiter.sessionId === message.sessionId) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message.params);
    }
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function nextEvent(method, sessionId) {
  return new Promise((resolve) => waiters.push({ method, sessionId, resolve }));
}

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile }, sessionId);
  if (dark) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sessionId);
  }
  if (seedScript) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript }, sessionId);
  }
  const loaded = nextEvent('Page.loadEventFired', sessionId);
  await send('Page.navigate', { url }, sessionId);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(out, Buffer.from(data, 'base64'));
  socket.close();
  finish(0);
} catch (error) {
  finish(1, error.message);
}
