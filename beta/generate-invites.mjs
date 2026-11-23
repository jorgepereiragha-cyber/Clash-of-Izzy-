// Run ONLY on a trusted local machine; never run in public CI logs.
// Usage: node beta/generate-invites.mjs 3 1 7
// args: number of codes (1..20), max uses each (1..100), expiry days (1..90)
import { randomBytes, createHash } from "node:crypto";
const [count = "3", maxUses = "1", days = "7"] = process.argv.slice(2);
const ints = [count, maxUses, days].map(Number);
if (!ints.every(Number.isSafeInteger) || ints[0]<1 || ints[0]>20 || ints[1]<1 || ints[1]>100 || ints[2]<1 || ints[2]>90) {
  throw new Error("Use: node beta/generate-invites.mjs <1..20 codes> <1..100 uses> <1..90 days>");
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function randomCode() {
  // Twenty independent base32 characters, each from five cryptographically random bits.
  // Mask 5 bits from random bytes; rejection is unnecessary because 32 divides 256.
  return "IZZY-" + Array.from(randomBytes(20), b => alphabet[b & 31]).join("");
}
const expiresAt = Math.floor(Date.now()/1000) + ints[2]*86400;
for (let i=0;i<ints[0];i++){
  const code=randomCode();
  const hash=createHash("sha256").update(code).digest("hex");
  process.stdout.write("INVITE (private): "+code+"\n");
  process.stdout.write("SQL: INSERT INTO beta_invites(code_hash,max_uses,expires_at) VALUES('"+hash+"',"+ints[1]+","+expiresAt+");\n");
}
