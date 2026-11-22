import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const workerPath = new URL('../portal-worker.js', import.meta.url);
const worker = (await import(pathToFileURL(workerPath.pathname).href)).default;
const calls = [];
const env = { ASSETS: { fetch: async (request) => { calls.push(request.url); return new Response('asset'); } } };
const request = (path, method='GET') => new Request(`https://portal.example${path}`, { method });

test('root redirects to marketing page and preserves campaign parameters', async () => {
  const response = await worker.fetch(request('/?utm_source=campaign&x=1'), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://portal.example/portal.html?utm_source=campaign&x=1');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('game and API paths are not routed to assets', async () => {
  for (const path of ['/api/health', '/api/login', '/kingdom.html', '/world.html', '/arena.html', '/account.html', '/cdn-cgi/../api/login']) {
    const before = calls.length;
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 404, path);
    assert.equal(calls.length, before, path);
  }
});

test('writes are rejected before asset routing', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const before = calls.length;
    const response = await worker.fetch(request('/portal.html', method), env);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
    assert.equal(calls.length, before);
  }
});

test('approved public assets work and unknown paths fail closed', async () => {
  for (const path of ['/portal', '/portal.html', '/favicon.svg', '/styles/coi-theme.css', '/assets/brand/hero-emblem.svg']) {
    assert.equal((await worker.fetch(request(path), env)).status, 200, path);
  }
  assert.equal((await worker.fetch(request('/portal.html/extra'), env)).status, 404);
});
