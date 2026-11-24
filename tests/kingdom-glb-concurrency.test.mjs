import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/kingdom-3d.js', import.meta.url), 'utf8');
function fixture() {
  const declaration = source.match(/  const glbLoadPromises = new Map\(\);[\s\S]*?let nextGlbLane = 0;/)?.[0];
  const scheduler = source.match(/  function scheduleManifestAsset\(entry\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(declaration && scheduler);
  const starts = [], releases = [];
  const ctx = vm.createContext({loadManifestAsset: entry => {
    starts.push(entry.key);
    return new Promise((resolve, reject) => releases.push({resolve, reject}));
  }});
  vm.runInContext(declaration + '\nlet disposed = false; let renderer = {};\n' + scheduler, ctx);
  return { starts, releases, schedule: key => vm.runInContext('scheduleManifestAsset', ctx)({key}),
    dispose: () => vm.runInContext('disposed = true; renderer = null;', ctx) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('overlapping GLB batches reserve keys and share three lanes', async () => {
  const f = fixture();
  const pending = ['a','b','c','d','e','f'].map(f.schedule);
  assert.equal(f.schedule('d'), null);
  await tick();
  assert.deepEqual(f.starts, ['a','b','c']);
  f.releases[0].resolve();
  await tick();
  assert.deepEqual(f.starts, ['a','b','c','d']);
  f.releases[1].resolve(); f.releases[2].resolve();
  await tick();
  assert.equal(f.starts.length, 6);
  f.releases.slice(3).forEach(x => x.resolve());
  await Promise.all(pending);
});

test('failed loads release reservations and disposed renderer skips queued work', async () => {
  const f = fixture();
  const a = f.schedule('a'), b = f.schedule('b'), c = f.schedule('c'), d = f.schedule('d');
  const failure = assert.rejects(a, /failed/);
  await tick();
  f.releases[0].reject(new Error('failed'));
  await failure;
  await tick();
  const retry = f.schedule('a');
  assert.ok(retry);
  f.dispose();
  f.releases.slice(1).forEach(x => x.resolve());
  await Promise.all([b,c,d,retry]);
  assert.deepEqual(f.starts, ['a','b','c','d']);
});
