import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchText,
  damerauLevenshteinDistance,
  typoDistanceForToken,
  fuzzyTokenDistance,
  buildTrigramSearchQuery
} from "../search-ranking.js";

test("normalization removes accents without changing the original display text", () => {
  assert.equal(normalizeSearchText("Dragón Épico"), "dragon epico");
});

test("Damerau-Levenshtein treats adjacent transposition as one edit", () => {
  assert.equal(damerauLevenshteinDistance("teh", "the", 1), 1);
  assert.equal(damerauLevenshteinDistance("iphone", "iphoen", 1), 1);
  assert.equal(damerauLevenshteinDistance("dragon", "dragn", 1), 1);
});

test("typo tolerance follows conservative length thresholds", () => {
  assert.equal(typoDistanceForToken("iphn", "iphone"), null);
  assert.equal(typoDistanceForToken("iphoen", "iphone"), 1);
  assert.equal(typoDistanceForToken("xphone", "phone"), null);
  assert.equal(typoDistanceForToken("xalliance", "alliance"), 2);
  assert.equal(typoDistanceForToken("knight", "knight"), 0);
});

test("multi-token matching requires every word and ranks by total typo cost", () => {
  assert.equal(fuzzyTokenDistance(["drgaon", "castle"], ["Dragon Castle"]), 1);
  assert.equal(fuzzyTokenDistance(["drgaon", "market"], ["Dragon Castle"]), null);
  assert.equal(fuzzyTokenDistance(["allaince"], ["Alliance Hall"]), 1);
});

test("numeric and CJK tokens are not fuzzily rewritten", () => {
  assert.equal(typoDistanceForToken("2026", "2025"), null);
  assert.equal(typoDistanceForToken("とうきょう", "とうきよ"), null);
  assert.equal(fuzzyTokenDistance(["tokyo", "東京"], ["Tokyo Japan"]), null);
});

test("CJK queries emit overlapping indexed trigrams without enabling typo substitution", () => {
  const chinese = buildTrigramSearchQuery(["城堡战争"]);
  assert.ok(chinese.includes('"城堡战"'));
  assert.ok(chinese.includes('"堡战争"'));

  const japanese = buildTrigramSearchQuery(["とうきょう"]);
  assert.ok(japanese.includes('"とうき"'));
  assert.ok(japanese.includes('"うきょ"'));
  assert.ok(japanese.includes('"きょう"'));

  const korean = buildTrigramSearchQuery(["서울전투"]);
  assert.ok(korean.includes('"서울전"'));
  assert.ok(korean.includes('"울전투"'));

  assert.equal(buildTrigramSearchQuery(["城堡"]), "");
  assert.equal(typoDistanceForToken("城保战争", "城堡战争"), null);
  assert.equal(fuzzyTokenDistance(["城堡战争"], ["古代城堡战争"]), 0);
  assert.equal(fuzzyTokenDistance(["城保战争"], ["古代城堡战争"]), null);
});

test("trigram candidate queries are bounded to supported alphabetic tokens", () => {
  const query = buildTrigramSearchQuery(["iphone", "2026", "城堡"]);
  assert.ok(query.includes('"iph"'));
  assert.ok(query.includes('"pho"'));
  assert.ok(!query.includes("2026"));
  assert.ok(!query.includes("城堡"));
  assert.equal(buildTrigramSearchQuery(["3", "abc"]), "");
});
