import { NextResponse } from 'next/server';
import { getDb, insertRow, updateRow, deleteRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getWeekStartDate } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('week_start') || getWeekStartDate();

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const plans = db.meal_plans.filter(
      (p) => p.user_id === userId && p.week_start_date === weekStart
    );

    return NextResponse.json({ plans, weekStart });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      week_start_date,
      day_of_week,
      meal_type,
      food_id,
      custom_name,
      servings = 1,
      calories,
      protein_g,
      carbs_g,
      fat_g,
    } = body;

    if (!day_of_week || !meal_type || !custom_name || calories === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const db = await getDb();

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const validFoodId =
      food_id && typeof food_id === 'string' && isUuid(food_id) && db.foods.some((f) => f.id === food_id)
        ? food_id
        : null;

    const targetWeek = week_start_date || getWeekStartDate();
    const cleanName = custom_name.trim();

    // Evitar duplicados idénticos en la misma comida del mismo día
    const existing = db.meal_plans.find(
      (p) =>
        p.user_id === userId &&
        p.week_start_date === targetWeek &&
        p.day_of_week === Number(day_of_week) &&
        p.meal_type === meal_type &&
        p.custom_name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) {
      const newServings = Number(existing.servings || 1) + (Number(servings) || 1);
      const factor = newServings / (Number(existing.servings) || 1);
      const updatedCalories = Math.round(Number(existing.calories) * factor);
      const updatedProtein = Number((Number(existing.protein_g) * factor).toFixed(1));
      const updatedCarbs = Number((Number(existing.carbs_g) * factor).toFixed(1));
      const updatedFat = Number((Number(existing.fat_g) * factor).toFixed(1));

      await updateRow('meal_plans', existing.id, {
        servings: newServings,
        calories: updatedCalories,
        protein_g: updatedProtein,
        carbs_g: updatedCarbs,
        fat_g: updatedFat,
      });

      return NextResponse.json({
        success: true,
        item: {
          ...existing,
          servings: newServings,
          calories: updatedCalories,
          protein_g: updatedProtein,
          carbs_g: updatedCarbs,
          fat_g: updatedFat,
        },
      });
    }

    const newItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      week_start_date: targetWeek,
      day_of_week: Number(day_of_week),
      meal_type,
      food_id: validFoodId,
      custom_name: cleanName,
      servings: Number(servings) || 1,
      calories: Math.round(Number(calories)),
      protein_g: Number(Number(protein_g || 0).toFixed(1)),
      carbs_g: Number(Number(carbs_g || 0).toFixed(1)),
      fat_g: Number(Number(fat_g || 0).toFixed(1)),
      created_at: new Date().toISOString(),
    };

    await insertRow('meal_plans', newItem);
    return NextResponse.json({ success: true, item: newItem });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const existing = db.meal_plans.find((p) => p.id === id && p.user_id === userId);
    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    await deleteRow('meal_plans', id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
