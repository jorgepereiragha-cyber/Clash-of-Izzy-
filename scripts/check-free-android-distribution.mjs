// Read-only prerequisite for distributing a free APK while checkout remains disabled.
import {pathToFileURL} from 'node:url';

export const ORIGIN = 'https://clash-of-izzy.jorgepereiragha.workers.dev';
export function assertFreeAndroidDistribution(methods) {
  if (!methods || typeof methods !== 'object' || Array.isArray(methods)) {
    throw new Error('Payment-methods response missing or invalid');
  }
  if (methods.mercadoPago !== false || methods.nubankPix !== false) {
    throw new Error('Free distribution blocked: payment methods must be explicitly disabled');
  }
  return {freeDistribution: true, checkoutEnabled: false};
}
export async function checkFreeAndroidDistribution(fetchImpl=fetch) {
  const response=await fetchImpl(ORIGIN+'/api/store/payment-methods', {
    method:'GET', redirect:'error', headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(12000)
  });
  if (!response || response.status!==200) throw new Error('Payment-methods API unavailable');
  const methods=await response.json().catch(()=>null);
  return assertFreeAndroidDistribution(methods);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { await checkFreeAndroidDistribution(); console.log('Free APK distribution payment gate: PASS (checkout disabled).'); }
  catch(error) { console.error('Free APK distribution blocked: '+error.message); process.exitCode=1; }
}
