import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';
import { resolveIngredientFiber } from '@/lib/utils/fiberUtils';

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const cleanCode = code?.trim();

    if (!cleanCode) {
      return NextResponse.json({ error: 'Código de barras no proporcionado' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Buscar primero en base de datos local
    const localMatch = db.foods.find((f) => f.barcode === cleanCode) || WHOLE_FOODS.find((f) => f.barcode === cleanCode);
    if (localMatch) {
      return NextResponse.json({
        source: 'local',
        product: {
          id: localMatch.id,
          name: localMatch.name,
          brand: localMatch.brand || '',
          barcode: localMatch.barcode,
          serving_size_g: localMatch.serving_size_g || 100,
          calories: localMatch.calories,
          protein_g: localMatch.protein_g,
          carbs_g: localMatch.carbs_g,
          fat_g: localMatch.fat_g,
          fiber_g: (localMatch as any).fiber_g || 0,
          sodium_mg: (localMatch as any).sodium_mg || 0,
        },
      });
    }

    // 2. Consultar a Open Food Facts API (versión mundial con nombres en español)
    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const offRes = await fetch(offUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DuoCalApp - NextJS - Version 1.0 (contacto: duocal@example.com)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!offRes.ok) {
      return NextResponse.json(
        { error: 'Producto no encontrado en la base de Open Food Facts', barcode: cleanCode },
        { status: 404 }
      );
    }

    const data = await offRes.json();
    if (!data || data.status === 0 || !data.product) {
      return NextResponse.json(
        { error: 'Producto no registrado en Open Food Facts', barcode: cleanCode },
        { status: 404 }
      );
    }

    const p = data.product;
    const nutriments = p.nutriments || {};

    // Nombre y marca
    const name =
      p.product_name_es ||
      p.product_name ||
      p.generic_name_es ||
      p.generic_name ||
      `Producto (${cleanCode})`;
    const brand = p.brands || p.brand_owner || '';

    // Tamaño de porción en gramos si viene disponible
    let servingGrams = 100;
    if (p.serving_quantity) {
      servingGrams = Number(p.serving_quantity) || 100;
    } else if (p.serving_size) {
      const match = String(p.serving_size).match(/(\d+(?:\.\d+)?)\s*(?:g|ml)/i);
      if (match) servingGrams = parseFloat(match[1]);
    }

    // Macros por 100g
    const calories100g = Math.round(
      nutriments['energy-kcal_100g'] ||
      (nutriments['energy-kj_100g'] ? nutriments['energy-kj_100g'] / 4.184 : 0) ||
      (nutriments['energy-kcal'] || 0)
    );
    const protein100g = Number((nutriments['proteins_100g'] || nutriments['proteins'] || 0).toFixed(1));
    const carbs100g = Number((nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0).toFixed(1));
    const fat100g = Number((nutriments['fat_100g'] || nutriments['fat'] || 0).toFixed(1));
    let fiber100g = Number((nutriments['fiber_100g'] || nutriments['fiber'] || 0).toFixed(1));
    if (fiber100g <= 0) {
      fiber100g = resolveIngredientFiber({ ingredient_name: name, amount_g: 100 });
    }
    const sodium100g = Math.round((nutriments['sodium_100g'] || (nutriments['salt_100g'] ? nutriments['salt_100g'] * 400 : 0) || 0));

    // Imagen
    const imageUrl = p.image_front_small_url || p.image_front_url || p.image_url || null;

    const normalizedProduct = {
      id: 'off-' + crypto.randomUUID().slice(0, 8),
      name,
      brand,
      barcode: cleanCode,
      serving_size_g: servingGrams,
      calories: calories100g,
      protein_g: protein100g,
      carbs_g: carbs100g,
      fat_g: fat100g,
      fiber_g: fiber100g,
      sodium_mg: sodium100g,
      image_url: imageUrl,
      categories_tags: p.categories_tags || [],
    };

    // Almacenar en la base local para consultas futuras
    db.foods.push({
      id: normalizedProduct.id,
      user_id: null,
      name: normalizedProduct.name,
      brand: normalizedProduct.brand,
      serving_size_g: 100,
      serving_unit: 'g',
      calories: normalizedProduct.calories,
      protein_g: normalizedProduct.protein_g,
      carbs_g: normalizedProduct.carbs_g,
      fat_g: normalizedProduct.fat_g,
      source: 'openfoodfacts',
      barcode: cleanCode,
      is_verified: true,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      source: 'openfoodfacts',
      product: normalizedProduct,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al procesar código de barras';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
