import { NextResponse } from 'next/server';
import { getDb, deleteRow, updateRow, insertRow } from '@/lib/store/mockDb';
import { isServiceRoleConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { WHOLE_FOODS } from '@/lib/data/wholeFoods';
import { resolveIngredientFiber } from '@/lib/utils/fiberUtils';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const dish = db.dishes.find((d) => d.id === id);
    if (!dish) return NextResponse.json({ error: 'Platillo no encontrado' }, { status: 404 });

    const ingredients = db.dish_ingredients.filter((di) => di.dish_id === dish.id);

    return NextResponse.json({
      dish: {
        ...dish,
        ingredients,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const existing = db.dishes.find((d) => d.id === id && d.user_id === userId);
    if (!existing) {
      return NextResponse.json({ error: 'Platillo no encontrado o sin permisos' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      category = existing.category,
      total_servings = existing.total_servings,
      serving_name = existing.serving_name,
      is_shared_with_partner = existing.is_shared_with_partner,
      prep_time_minutes = existing.prep_time_minutes,
      cook_time_minutes = existing.cook_time_minutes,
      instructions,
      ingredients = [],
    } = body;

    const servings = Math.max(0.5, Number(total_servings) || 1);

    let totalCals = 0;
    let totalProt = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalWeight = 0;

    const processedIngredients: any[] = [];
    for (const ing of ingredients) {
      const weight = Number(ing.amount_g) || 100;
      const cals = Math.round(Number(ing.calories) || 0);
      const prot = Number(Number(ing.protein_g || 0).toFixed(1));
      const carbs = Number(Number(ing.carbs_g || 0).toFixed(1));
      const fat = Number(Number(ing.fat_g || 0).toFixed(1));
      const fiber = resolveIngredientFiber(ing, db.foods);
      const sodium = Number(ing.sodium_mg || 0);

      totalCals += cals;
      totalProt += prot;
      totalCarbs += carbs;
      totalFat += fat;
      totalFiber += fiber;
      totalWeight += weight;

      processedIngredients.push({
        id: crypto.randomUUID(),
        dish_id: id,
        food_id: ing.food_id || null,
        ingredient_name: (ing.ingredient_name || '').trim(),
        amount_g: weight,
        calories: cals,
        protein_g: prot,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: fiber,
        sodium_mg: sodium,
        created_at: new Date().toISOString(),
      });
    }

    if (totalFiber === 0 && Number(existing.total_fiber_g) > 0 && processedIngredients.length === 0) {
      totalFiber = Number(existing.total_fiber_g);
    }

    const updatedDish = {
      ...existing,
      name: (name || existing.name).trim(),
      description: description !== undefined ? description?.trim() || null : existing.description,
      category,
      total_servings: servings,
      total_weight_g: totalWeight,
      serving_name: serving_name || 'porción',
      is_shared_with_partner: Boolean(is_shared_with_partner),
      prep_time_minutes: Number(prep_time_minutes) || 10,
      cook_time_minutes: Number(cook_time_minutes) || 15,
      instructions: Array.isArray(instructions) ? instructions : existing.instructions,
      total_calories: totalCals,
      total_protein_g: Number(totalProt.toFixed(1)),
      total_carbs_g: Number(totalCarbs.toFixed(1)),
      total_fat_g: Number(totalFat.toFixed(1)),
      total_fiber_g: Number(totalFiber.toFixed(1)),
      calories_per_serving: Math.round(totalCals / servings),
      protein_per_serving: Number((totalProt / servings).toFixed(1)),
      carbs_per_serving: Number((totalCarbs / servings).toFixed(1)),
      fat_per_serving: Number((totalFat / servings).toFixed(1)),
      fiber_per_serving: Number((totalFiber / servings).toFixed(1)),
    };

    await updateRow('dishes', id, updatedDish);

    // Reemplazar ingredientes en Supabase y memoria
    if (isServiceRoleConfigured) {
      await supabaseAdmin.from('dish_ingredients').delete().eq('dish_id', id);
    }
    db.dish_ingredients = db.dish_ingredients.filter((di) => di.dish_id !== id);
    for (const ing of processedIngredients) {
      await insertRow('dish_ingredients', ing);
    }

    return NextResponse.json({
      success: true,
      dish: {
        ...updatedDish,
        ingredients: processedIngredients,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar platillo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const existing = db.dishes.find((d) => d.id === id && d.user_id === userId);
    if (!existing) {
      return NextResponse.json({ error: 'Platillo no encontrado o sin permisos' }, { status: 404 });
    }

    await deleteRow('dishes', id);
    if (isServiceRoleConfigured) {
      await supabaseAdmin.from('dish_ingredients').delete().eq('dish_id', id);
    }
    db.dish_ingredients = db.dish_ingredients.filter((di) => di.dish_id !== id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar platillo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
