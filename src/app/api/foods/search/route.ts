import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import { Food } from '@/types/database';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';
import { calculateFuzzyScore } from '@/lib/utils/fuzzySearch';
import { resolveIngredientFiber } from '@/lib/utils/fiberUtils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q')?.trim() || '';
    const query = rawQuery.toLowerCase();
    const category = searchParams.get('category')?.toLowerCase();

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;

    const db = await getDb();

    // 1. Si no hay término de búsqueda, devolver catálogo de alimentos básicos populares
    if (!query) {
      const popular = WHOLE_FOODS.filter((f) => {
        if (!category || category === 'all') return true;
        return f.category === category;
      }).slice(0, 15);
      return NextResponse.json({ foods: popular });
    }

    // 2. Combinar catálogo verificado de alimentos naturales/enteros + base de datos local
    const allLocalCandidates: Food[] = [...WHOLE_FOODS];

    // Añadir alimentos locales guardados por el usuario o globales en la base de datos
    for (const f of db.foods) {
      if (f.user_id === null || f.user_id === userId) {
        if (!allLocalCandidates.some((c) => c.name.toLowerCase() === f.name.toLowerCase())) {
          allLocalCandidates.push(f);
        }
      }
    }

    // Puntuador de relevancia inteligente con tolerancia a errores ortográficos (Fuzzy Matching)
    const scoredCandidates = allLocalCandidates
      .map((f) => {
        const nameScore = calculateFuzzyScore(f.name, rawQuery);
        const brandScore = f.brand ? calculateFuzzyScore(f.brand, rawQuery) : { matches: false, score: 0 };
        const barcodeMatch = f.barcode && f.barcode === query;

        let bestScore = Math.max(nameScore.score, brandScore.score);
        let matches = nameScore.matches || brandScore.matches || Boolean(barcodeMatch);

        if (barcodeMatch) {
          bestScore = 300;
          matches = true;
        }

        // Bonus para alimentos verificados / naturales
        if (matches) {
          if (f.is_verified) bestScore += 20;
          if (f.source === 'manual') bestScore += 15;
        }

        return { food: f, matches, score: bestScore };
      })
      .filter((item) => item.matches && item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Si hay coincidencias directas/altas (coincidencia de término completo o subcadena, score >= 120):
    // filtramos falsos positivos difusos para que "lechuga" solo muestre lechuga y no pechuga
    const hasExactOrHighMatch = scoredCandidates.some((c) => c.score >= 120);
    const matchedLocal = (
      hasExactOrHighMatch
        ? scoredCandidates.filter((c) => c.score >= 120)
        : scoredCandidates
    ).map((c) => c.food);

    // 3. Consulta complementaria a Open Food Facts API para productos comerciales empaquetados
    const offResults: Food[] = [];
    // Si ya tenemos muy buenas coincidencias en alimentos naturales, pedimos menos o solo como respaldo
    const needMore = matchedLocal.length < 8;

    if (needMore && query.length >= 3) {
      try {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          rawQuery
        )}&search_simple=1&action=process&json=1&page_size=8`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const offRes = await fetch(offUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DuoCalApp - NextJS - Version 1.0' },
        });
        clearTimeout(timeoutId);

        if (offRes.ok) {
          const data = await offRes.json();
          if (data.products && Array.isArray(data.products)) {
            for (const item of data.products) {
              const name = (item.product_name_es || item.product_name || '').trim();
              if (!name) continue;

              // Validar contra nuestro evaluador difuso
              const offScore = calculateFuzzyScore(name, rawQuery);
              if (!offScore.matches || offScore.score < (hasExactOrHighMatch ? 80 : 50)) {
                continue;
              }

              const lowerName = name.toLowerCase();
              // Filtrar si es un vinagre o no relevante cuando buscan fruta/básicos
              if (lowerName.includes('vinagre') && !query.includes('vinagre')) continue;

              const nutriments = item.nutriments || {};
              const calories = Math.round(
                nutriments['energy-kcal_100g'] ||
                  (nutriments['energy-kj_100g'] ? nutriments['energy-kj_100g'] / 4.184 : 0) ||
                  0
              );
              const protein = Number(nutriments['proteins_100g'] || 0);
              const carbs = Number(nutriments['carbohydrates_100g'] || 0);
              const fat = Number(nutriments['fat_100g'] || 0);
              let fiber = Number((nutriments['fiber_100g'] || nutriments['fiber'] || 0).toFixed(1));
              if (fiber <= 0) {
                fiber = resolveIngredientFiber({ ingredient_name: name, amount_g: 100 });
              }

              if (calories > 0 || protein > 0 || carbs > 0 || fat > 0) {
                // Evitar duplicados con los locales
                if (!matchedLocal.some((m) => m.name.toLowerCase() === lowerName)) {
                  offResults.push({
                    id: 'off-' + (item.code || Math.random().toString(36).substring(2, 7)),
                    user_id: null,
                    name,
                    brand: item.brands ? `${item.brands} (Comercial)` : 'Producto envasado',
                    serving_size_g: 100,
                    serving_unit: 'g',
                    calories,
                    protein_g: Number(protein.toFixed(1)),
                    carbs_g: Number(carbs.toFixed(1)),
                    fat_g: Number(fat.toFixed(1)),
                    fiber_g: fiber,
                    source: 'openfoodfacts',
                    barcode: item.code || null,
                    is_verified: false,
                    created_at: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      } catch {
        // Fallos de red hacia Open Food Facts se ignoran limpiamente
      }
    }

    // Unir: PRIMERO los alimentos naturales/sueltos verificados, luego los productos envasados
    const combined = [...matchedLocal, ...offResults];
    return NextResponse.json({ foods: combined.slice(0, 25) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al buscar alimentos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
