import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyGoogleIdToken,isGoogleWebClientId} from "../google-identity.js";
const cryptoImpl=globalThis.crypto||webcrypto;
const clientId="123456789012-test-example.apps.googleusercontent.com";
const nonce="12345678-1234-1234-1234-123456789012-12345678-1234-1234-1234-123456789012";
const now=1800000000;
const encoder=new TextEncoder();
const base64url=bytes=>Buffer.from(bytes).toString("base64url");
const encoded=value=>base64url(encoder.encode(JSON.stringify(value)));

test("Google validator enforces RS256 signature, audience, nonce, issuer, and expiry",async()=>{
  const pair=await cryptoImpl.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const jwk=await cryptoImpl.subtle.exportKey("jwk",pair.publicKey);
  const readKeys=async()=>new Response(JSON.stringify({keys:[{...jwk,kid:"test-google-rotating-key",alg:"RS256",use:"sig"}]}),{status:200});
  const sign=async (claims,header={alg:"RS256",kid:"test-google-rotating-key",typ:"JWT"})=>{
    const body=encoded(header)+"."+encoded(claims);
    const signature=await cryptoImpl.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,encoder.encode(body));
    return body+"."+base64url(signature);
  };
  const claims={iss:"https://accounts.google.com",sub:"11223344556677889900",aud:clientId,nonce,iat:now-20,exp:now+3600};
  assert.deepEqual(await verifyGoogleIdToken(await sign(claims),clientId,nonce,readKeys,now),{sub:claims.sub});
  const invalid=[
    {...claims,aud:"999999999-test.apps.googleusercontent.com"}, {...claims,iss:"https://evil.com"},
    {...claims,nonce:"another-nonce"}, {...claims,exp:now}, {...claims,iat:now+600},
    {...claims,sub:"not-google-identity"}
  ];
  for(const one of invalid) {
    const signed=await sign(one);
    await assert.rejects(()=>verifyGoogleIdToken(signed,clientId,nonce,readKeys,now));
  }
  const valid=await sign(claims),chunks=valid.split(".");
  const forged=chunks[0]+"."+encoded({...claims,sub:"99999999999999999999"})+"."+chunks[2];
  await assert.rejects(()=>verifyGoogleIdToken(forged,clientId,nonce,readKeys,now));
  const noneAlgorithm=await sign(claims,{alg:"none",kid:"test-google-rotating-key"});
  await assert.rejects(()=>verifyGoogleIdToken(noneAlgorithm,clientId,nonce,readKeys,now));
  assert.equal(isGoogleWebClientId(clientId),true);
  assert.equal(isGoogleWebClientId("https://google.com"),false);
});
