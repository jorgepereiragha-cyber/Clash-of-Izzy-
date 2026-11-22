// Offline regression tests: public Android release must have APK and checksum.
// Run: node --test tests/android-public-release-assets.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

export function validatePublicAndroidRelease(release) {
  if (!release || typeof release !== 'object' || release.draft || release.prerelease || !release.published_at) return false;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apk = assets.filter(a => a && typeof a.name === 'string' && /\.apk$/i.test(a.name));
  const checksums = assets.filter(a => a && typeof a.name === 'string' && /(?:sha256(?:sums?)?|checksums?)(?:[.-].*)?\.(?:txt|sha256)$/i.test(a.name));
  const valid = a => a.state === 'uploaded' && Number.isSafeInteger(a.size) && a.size > 0 &&
    typeof a.browser_download_url === 'string' &&
    a.browser_download_url.startsWith('https://github.com/') &&
    a.browser_download_url.includes('/releases/download/');
  return apk.length === 1 && checksums.length >= 1 && apk.every(valid) && checksums.every(valid);
}

const asset = (name, size = 1024) => ({
  name, size, state: 'uploaded',
  browser_download_url: 'https://github.com/example/game/releases/download/v1/' + name
});
const good = () => ({draft:false, prerelease:false, published_at:'2026-11-22T00:00:00Z',
  assets:[asset('clash-of-izzy.apk', 1000000),asset('SHA256SUMS.txt')]});

test('accepts published release with uploaded APK and SHA256 manifest', () => {
  assert.equal(validatePublicAndroidRelease(good()), true);
});
test('rejects draft and prerelease', () => {
  assert.equal(validatePublicAndroidRelease({...good(),draft:true}), false);
  assert.equal(validatePublicAndroidRelease({...good(),prerelease:true}), false);
});
test('rejects missing APK or checksum', () => {
  assert.equal(validatePublicAndroidRelease({...good(),assets:[asset('SHA256SUMS.txt')]}), false);
  assert.equal(validatePublicAndroidRelease({...good(),assets:[asset('game.apk')]}), false);
});
test('rejects duplicate APK, empty asset, pending upload, and offsite URL', () => {
  assert.equal(validatePublicAndroidRelease({...good(),assets:[...good().assets,asset('other.apk')]}), false);
  assert.equal(validatePublicAndroidRelease({...good(),assets:[asset('game.apk',0),asset('SHA256SUMS.txt')]}), false);
  assert.equal(validatePublicAndroidRelease({...good(),assets:[{...asset('game.apk'),state:'new'},asset('SHA256SUMS.txt')]}), false);
  assert.equal(validatePublicAndroidRelease({...good(),assets:[{...asset('game.apk'),browser_download_url:'https://evil.example/a.apk'},asset('SHA256SUMS.txt')]}), false);
});
test('rejects unpublished or malformed release', () => {
  assert.equal(validatePublicAndroidRelease(null), false);
  assert.equal(validatePublicAndroidRelease({...good(),published_at:null}), false);
});
