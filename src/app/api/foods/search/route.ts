import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import { Food } from '@/types/database';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';

    if (!query) {
      return NextResponse.json({ foods: [] });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;

    const db = await getDb();

    // 1. Alimentos locales en base de datos (globales o propios del usuario)
    const localMatches = db.foods.filter((f) => {
      const matchOwner = f.user_id === null || f.user_id === userId;
      const matchName = f.name.toLowerCase().includes(query) || (f.brand && f.brand.toLowerCase().includes(query));
      const matchBarcode = f.barcode && f.barcode === query;
      return matchOwner && (matchName || matchBarcode);
    });

    // 2. Consulta a Open Food Facts API (con timeout de 3s para evitar latencia)
    const offResults: Food[] = [];
    try {
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        query
      )}&search_simple=1&action=process&json=1&page_size=8`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const offRes = await fetch(offUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DuoCalApp - NextJS - Version 1.0' },
      });
      clearTimeout(timeoutId);

      if (offRes.ok) {
        const data = await offRes.json();
        if (data.products && Array.isArray(data.products)) {
          for (const item of data.products) {
            const nutriments = item.nutriments || {};
            const calories = Math.round(
              nutriments['energy-kcal_100g'] ||
              (nutriments['energy-kj_100g'] ? nutriments['energy-kj_100g'] / 4.184 : 0) ||
              0
            );
            const protein = Number(nutriments['proteins_100g'] || 0);
            const carbs = Number(nutriments['carbohydrates_100g'] || 0);
            const fat = Number(nutriments['fat_100g'] || 0);
            const name = item.product_name_es || item.product_name || '';

            if (name && (calories > 0 || protein > 0 || carbs > 0 || fat > 0)) {
              offResults.push({
                id: 'off-' + (item.code || Math.random().toString(36).substring(2, 7)),
                user_id: null,
                name,
                brand: item.brands || null,
                serving_size_g: 100,
                serving_unit: 'g',
                calories,
                protein_g: Number(protein.toFixed(1)),
                carbs_g: Number(carbs.toFixed(1)),
                fat_g: Number(fat.toFixed(1)),
                source: 'openfoodfacts',
                barcode: item.code || null,
                is_verified: true,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {
      // Ignorar fallos de red hacia Open Food Facts y devolver los locales
    }

    // Unir resultados evitando duplicados exactos
    const combined = [...localMatches, ...offResults];
    return NextResponse.json({ foods: combined.slice(0, 20) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al buscar alimentos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
