import { NextResponse } from 'next/server';
import { getDb, insertRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { Dish, DishIngredient } from '@/types/database';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);

    // Obtener platillos propios o compartidos en el household
    const userDishes = db.dishes.filter((d) => {
      const isOwner = d.user_id === userId;
      const isPartnerShared =
        d.is_shared_with_partner &&
        user?.household_id &&
        d.household_id === user.household_id;
      return isOwner || isPartnerShared;
    });

    // Adjuntar ingredientes a cada platillo
    const dishesWithIngredients = userDishes.map((dish) => {
      const ingredients = db.dish_ingredients.filter((di) => di.dish_id === dish.id);
      return {
        ...dish,
        ingredients,
        is_owner: dish.user_id === userId,
      };
    });

    return NextResponse.json({ dishes: dishesWithIngredients });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener platillos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);

    const body = await req.json();
    const {
      name,
      description,
      category = 'lunch',
      total_servings = 1,
      serving_name = 'porción',
      is_shared_with_partner = true,
      ingredients = [], // Array de { food_id, ingredient_name, amount_g, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg }
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del platillo es obligatorio' }, { status: 400 });
    }

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Agrega al menos un ingrediente para calcular los valores nutrimentales' },
        { status: 400 }
      );
    }

    const dishId = crypto.randomUUID();
    const servings = Math.max(0.5, Number(total_servings) || 1);

    // Sumar ingredientes
    let totalCals = 0;
    let totalProt = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalWeight = 0;

    const processedIngredients: DishIngredient[] = [];

    for (const ing of ingredients) {
      const weight = Number(ing.amount_g) || 100;
      const cals = Math.round(Number(ing.calories) || 0);
      const prot = Number(Number(ing.protein_g || 0).toFixed(1));
      const carbs = Number(Number(ing.carbs_g || 0).toFixed(1));
      const fat = Number(Number(ing.fat_g || 0).toFixed(1));
      const fiber = Number(Number(ing.fiber_g || 0).toFixed(1));
      const sodium = Number(ing.sodium_mg || 0);

      totalCals += cals;
      totalProt += prot;
      totalCarbs += carbs;
      totalFat += fat;
      totalFiber += fiber;
      totalWeight += weight;

      const ingRecord: DishIngredient = {
        id: crypto.randomUUID(),
        dish_id: dishId,
        food_id: ing.food_id || null,
        ingredient_name: ing.ingredient_name.trim(),
        amount_g: weight,
        calories: cals,
        protein_g: prot,
        carbs_g: carbs,
        fat_g: fat,
        fiber_g: fiber,
        sodium_mg: sodium,
        created_at: new Date().toISOString(),
      };

      processedIngredients.push(ingRecord);
      await insertRow('dish_ingredients', ingRecord);
    }

    const newDish: Dish = {
      id: dishId,
      user_id: userId,
      household_id: user?.household_id || null,
      name: name.trim(),
      description: description?.trim() || null,
      category,
      total_servings: servings,
      total_weight_g: totalWeight,
      serving_name: serving_name || 'porción',
      is_shared_with_partner: Boolean(is_shared_with_partner),
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
      created_at: new Date().toISOString(),
    };

    await insertRow('dishes', newDish);

    return NextResponse.json({
      success: true,
      dish: {
        ...newDish,
        ingredients: processedIngredients,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar platillo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
