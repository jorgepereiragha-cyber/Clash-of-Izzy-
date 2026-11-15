// Bounded typo handling for public game search. Candidate generation stays in FTS5;
// this module only reranks the small, indexed candidate set. Numeric and CJK terms
// are intentionally excluded from edit-distance matching to avoid false positives.
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\p{M}]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const supportedFuzzyToken = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]+$/u;
const searchWordPattern = /[\p{L}\p{N}_]+/gu;

export function isTypoEligibleToken(value) {
  const token = normalizeSearchText(value);
  const length = Array.from(token).length;
  return length >= 5 && supportedFuzzyToken.test(token);
}

// Unrestricted Damerau–Levenshtein distance (adjacent transpositions cost one).
// Returns null when the distance is greater than maxDistance.
export function damerauLevenshteinDistance(left, right, maxDistance = 2) {
  const source = Array.from(String(left ?? ""));
  const target = Array.from(String(right ?? ""));
  const sourceLength = source.length;
  const targetLength = target.length;
  const maximum = Math.max(0, Math.floor(Number(maxDistance) || 0));

  if (Math.abs(sourceLength - targetLength) > maximum) return null;
  if (sourceLength === 0) return targetLength <= maximum ? targetLength : null;
  if (targetLength === 0) return sourceLength <= maximum ? sourceLength : null;

  const infinity = sourceLength + targetLength;
  const matrix = Array.from(
    { length: sourceLength + 2 },
    () => new Array(targetLength + 2).fill(0)
  );
  matrix[0][0] = infinity;

  for (let i = 0; i <= sourceLength; i += 1) {
    matrix[i + 1][0] = infinity;
    matrix[i + 1][1] = i;
  }
  for (let j = 0; j <= targetLength; j += 1) {
    matrix[0][j + 1] = infinity;
    matrix[1][j + 1] = j;
  }

  const lastSeen = new Map();
  for (let i = 1; i <= sourceLength; i += 1) {
    let lastMatchColumn = 0;
    for (let j = 1; j <= targetLength; j += 1) {
      const previousRow = lastSeen.get(target[j - 1]) || 0;
      const previousColumn = lastMatchColumn;
      let substitutionCost = 1;

      if (source[i - 1] === target[j - 1]) {
        substitutionCost = 0;
        lastMatchColumn = j;
      }

      matrix[i + 1][j + 1] = Math.min(
        matrix[i][j] + substitutionCost,
        matrix[i + 1][j] + 1,
        matrix[i][j + 1] + 1,
        matrix[previousRow][previousColumn]
          + (i - previousRow - 1)
          + 1
          + (j - previousColumn - 1)
      );
    }
    lastSeen.set(source[i - 1], i);
  }

  const distance = matrix[sourceLength + 1][targetLength + 1];
  return distance <= maximum ? distance : null;
}

export function typoDistanceForToken(queryToken, candidateToken) {
  const query = normalizeSearchText(queryToken);
  const candidate = normalizeSearchText(candidateToken);
  if (!query || !candidate || query === candidate) return 0;
  if (!isTypoEligibleToken(query) || !supportedFuzzyToken.test(candidate)) return null;

  const queryLength = Array.from(query).length;
  const candidateLength = Array.from(candidate).length;
  const maximum = queryLength >= 9 ? 2 : 1;
  if (candidateLength < queryLength - maximum || candidateLength > queryLength + maximum) return null;
  const baseDistance = damerauLevenshteinDistance(query, candidate, maximum);
  if (baseDistance === null) return null;

  // A first-character substitution is deliberately more expensive, reducing
  // accidental matches between unrelated names with a shared suffix.
  const firstCharacterPenalty = Array.from(query)[0] === Array.from(candidate)[0] ? 0 : 1;
  const totalDistance = baseDistance + firstCharacterPenalty;
  return totalDistance <= maximum ? totalDistance : null;
}

// Each token must match exactly/contiguously or be within the bounded edit budget
// of a complete indexed word. Returns total typo cost, or null for no full match.
export function fuzzyTokenDistance(queryTokens, fields) {
  const tokens = Array.isArray(queryTokens) ? queryTokens : [];
  const normalizedFields = (Array.isArray(fields) ? fields : [])
    .map(normalizeSearchText)
    .filter(Boolean);
  const words = normalizedFields.flatMap(field => field.match(searchWordPattern) || []);
  let totalTypos = 0;

  for (const rawToken of tokens) {
    const token = normalizeSearchText(rawToken);
    if (!token) continue;
    if (normalizedFields.some(field => field.includes(token))) continue;

    if (!isTypoEligibleToken(token)) return null;
    let bestDistance = null;
    for (const word of words) {
      const distance = typoDistanceForToken(token, word);
      if (distance !== null && (bestDistance === null || distance < bestDistance)) {
        bestDistance = distance;
        if (bestDistance === 0) break;
      }
    }
    if (bestDistance === null) return null;
    totalTypos += bestDistance;
  }

  return totalTypos;
}

const cjkScripts = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// FTS5 trigram OR-query: Latin typo candidates and CJK substring candidates are
// selected from the indexed corpus. The final verifier still requires every
// original token to be present or a Latin token to pass bounded edit distance.
export function buildTrigramSearchQuery(tokens) {
  const grams = new Set();
  for (const rawToken of Array.isArray(tokens) ? tokens : []) {
    // Preserve precomposed CJK code points for FTS5 trigram lookup. NFKD is
    // useful for accent-insensitive Latin matching but decomposes Hangul
    // syllables into jamo, which do not match the indexed source trigrams.
    const rawText = String(rawToken ?? "").normalize("NFC").toLocaleLowerCase("pt-BR").trim();
    const token = cjkScripts.test(rawText) ? rawText : normalizeSearchText(rawText);
    const characters = Array.from(token);
    if (isTypoEligibleToken(token)) {
      for (let index = 0; index <= characters.length - 3; index += 1) {
        grams.add(characters.slice(index, index + 3).join(""));
      }
    } else if (cjkScripts.test(token) && characters.length >= 3) {
      // Overlapping code-point trigrams work for Chinese/Japanese/Korean text
      // that has no whitespace word boundaries. One/two-character searches
      // continue to use the existing exact/LIKE fallback.
      for (let index = 0; index <= characters.length - 3; index += 1) {
        grams.add(characters.slice(index, index + 3).join(""));
      }
    }
  }
  if (!grams.size) return "";
  return [...grams].map(gram => '"' + gram.replace(/"/g, '""') + '"').join(" OR ");
}
