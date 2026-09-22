// src/lib/utils/fuzzySearch.ts

/**
 * Normaliza cadenas removiendo acentos, puntuación y convirtiendo a minúsculas.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const m = s1.length;
  const n = s2.length;
  // Optimización de memoria: solo dos filas
  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const c1 = s1[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = c1 === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // eliminación
        currRow[j - 1] + 1, // inserción
        prevRow[j - 1] + cost // sustitución
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

export interface FuzzyMatchResult {
  matches: boolean;
  score: number;
  matchedField?: string;
}

/**
 * Evalúa si una palabra del query coincide con una palabra del candidato.
 */
function matchSingleToken(queryToken: string, candidateWord: string): { match: boolean; score: number } {
  if (!queryToken || !candidateWord) return { match: false, score: 0 };

  // 1. Coincidencia exacta de palabra
  if (candidateWord === queryToken) {
    return { match: true, score: 100 };
  }

  // 2. Prefijo exacto (ej. "manz" -> "manzana")
  if (candidateWord.startsWith(queryToken)) {
    // Si el query tiene al menos 3 caracteres
    if (queryToken.length >= 3) {
      return { match: true, score: 80 };
    }
    // Si tiene 2 caracteres, solo si la palabra objetivo es corta
    if (candidateWord.length <= 4) {
      return { match: true, score: 60 };
    }
  }

  // 3. Tolerancia a errores ortográficos (Fuzzy Matching)
  // No permitir errores en palabras de 1 a 3 caracteres para evitar falsos positivos
  if (queryToken.length <= 3) {
    return { match: false, score: 0 };
  }

  const maxDistance = queryToken.length <= 6 ? 1 : 2;
  const dist = levenshteinDistance(queryToken, candidateWord);
  const maxLen = Math.max(queryToken.length, candidateWord.length);
  const similarity = 1 - dist / maxLen;

  // Si la palabra candidata es más larga (ej. "lechugón" vs "leghuga"),
  // checar si el prefijo del candidato es similar
  let prefixDist = 999;
  if (candidateWord.length > queryToken.length) {
    const sub = candidateWord.slice(0, queryToken.length);
    prefixDist = levenshteinDistance(queryToken, sub);
  }

  const bestDist = Math.min(dist, prefixDist);

  if (bestDist <= maxDistance && similarity >= 0.72) {
    // Puntuación decreciente según número de ediciones
    const score = bestDist === 1 ? 65 : 45;
    return { match: true, score };
  }

  return { match: false, score: 0 };
}

/**
 * Evalúa la similitud global entre un texto candidato y la consulta del usuario.
 */
export function calculateFuzzyScore(candidateText: string, rawQuery: string): FuzzyMatchResult {
  const normCand = normalizeText(candidateText);
  const normQuery = normalizeText(rawQuery);

  if (!normQuery) {
    return { matches: true, score: 0 };
  }

  // Coincidencia exacta de frase completa
  if (normCand === normQuery) {
    return { matches: true, score: 200 };
  }

  // Empieza exactamente con la frase completa
  if (normCand.startsWith(normQuery)) {
    return { matches: true, score: 160 };
  }

  // Contiene la frase completa
  if (normCand.includes(normQuery)) {
    return { matches: true, score: 130 };
  }

  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  const candWords = normCand.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return { matches: false, score: 0 };
  }

  let totalTokenScore = 0;
  let allTokensMatched = true;

  for (const qToken of queryTokens) {
    let bestTokenScore = 0;
    let foundMatch = false;

    for (const cWord of candWords) {
      const res = matchSingleToken(qToken, cWord);
      if (res.match && res.score > bestTokenScore) {
        bestTokenScore = res.score;
        foundMatch = true;
      }
    }

    if (!foundMatch) {
      allTokensMatched = false;
      break;
    }

    totalTokenScore += bestTokenScore;
  }

  if (allTokensMatched) {
    // Normalizar score por cantidad de tokens
    const avgScore = totalTokenScore / queryTokens.length;
    return { matches: true, score: avgScore };
  }

  return { matches: false, score: 0 };
}
