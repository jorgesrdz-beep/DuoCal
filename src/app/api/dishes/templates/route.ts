import { NextResponse } from 'next/server';
import { STARTER_RECIPES } from '@/lib/data/starterRecipes';
import { getDb, insertRow } from '@/lib/store/mockDb';
import { resolveIngredientFiber } from '@/lib/utils/fiberUtils';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  return NextResponse.json({ templates: STARTER_RECIPES });
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { templateId, servings } = body;

    const template = STARTER_RECIPES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);

    const baseServings = template.total_servings || 1;
    const targetServings = Math.max(0.5, Number(servings) || baseServings);
    const ratio = targetServings / baseServings;

    const newDishId = crypto.randomUUID();

    // Clonar ingredientes escalados a las porciones deseadas
    const clonedIngredients = [];
    let sumIngFiber = 0;
    if (template.ingredients && template.ingredients.length > 0) {
      for (const ing of template.ingredients) {
        const scaledWeight = Math.round(ing.amount_g * ratio);
        const resolvedFiber = resolveIngredientFiber(
          {
            food_id: ing.food_id || null,
            ingredient_name: ing.ingredient_name,
            amount_g: scaledWeight,
            fiber_g: ing.fiber_g ? Number((ing.fiber_g * ratio).toFixed(1)) : 0,
          },
          db.foods
        );
        sumIngFiber += resolvedFiber;

        const isValidUuid = typeof ing.food_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ing.food_id);
        const scaledIng = {
          id: crypto.randomUUID(),
          dish_id: newDishId,
          food_id: isValidUuid ? ing.food_id : null,
          ingredient_name: ing.ingredient_name,
          amount_g: scaledWeight,
          calories: Math.round(ing.calories * ratio),
          protein_g: Number((ing.protein_g * ratio).toFixed(1)),
          carbs_g: Number((ing.carbs_g * ratio).toFixed(1)),
          fat_g: Number((ing.fat_g * ratio).toFixed(1)),
          fiber_g: resolvedFiber,
          sodium_mg: ing.sodium_mg ? Math.round(ing.sodium_mg * ratio) : 0,
          aisle_category: ing.aisle_category || 'Otros',
          created_at: new Date().toISOString(),
        };
        clonedIngredients.push(scaledIng);
      }
    }

    const calculatedTotalFiber = sumIngFiber > 0
      ? Number(sumIngFiber.toFixed(1))
      : Number(((template.fiber_per_serving || 0) * targetServings).toFixed(1));
    const calculatedFiberPerServing = Number((calculatedTotalFiber / targetServings).toFixed(1));

    const clonedDish = {
      id: newDishId,
      user_id: userId,
      household_id: user?.household_id || null,
      name: template.name + (targetServings !== baseServings ? ` (${targetServings} porciones)` : ''),
      description: template.description || null,
      category: template.category || 'general',
      total_servings: targetServings,
      total_weight_g: template.total_weight_g ? Math.round(template.total_weight_g * ratio) : null,
      serving_name: template.serving_name || 'porción',
      is_shared_with_partner: true,
      total_calories: Math.round(template.calories_per_serving * targetServings),
      total_protein_g: Number((template.protein_per_serving * targetServings).toFixed(1)),
      total_carbs_g: Number((template.carbs_per_serving * targetServings).toFixed(1)),
      total_fat_g: Number((template.fat_per_serving * targetServings).toFixed(1)),
      total_fiber_g: calculatedTotalFiber,
      calories_per_serving: template.calories_per_serving,
      protein_per_serving: template.protein_per_serving,
      carbs_per_serving: template.carbs_per_serving,
      fat_per_serving: template.fat_per_serving,
      fiber_per_serving: calculatedFiberPerServing,
      prep_time_minutes: template.prep_time_minutes || 0,
      cook_time_minutes: template.cook_time_minutes || 0,
      instructions: template.instructions || [],
      is_starter_template: false,
      created_at: new Date().toISOString(),
    };

    await insertRow('dishes', clonedDish);

    for (const scaledIng of clonedIngredients) {
      await insertRow('dish_ingredients', scaledIng);
    }

    return NextResponse.json({
      success: true,
      dish: {
        ...clonedDish,
        ingredients: clonedIngredients,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al clonar plantilla';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
