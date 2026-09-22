import { NextResponse } from 'next/server';
import { getDb, insertRow, deleteRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getWeekStartDate, getSmartMealPrepWeekStartDate, getLocalDateString } from '@/lib/utils';
import { ConsumptionSchedule, FrequencyType, MealType } from '@/types/database';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const schedules = db.consumption_schedules.filter((s) => s.user_id === userId);
    return NextResponse.json({ schedules });
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

    const db = await getDb();
    const body = await req.json();

    const {
      dish_id,
      meal_type = 'lunch' as MealType,
      frequency_type = 'weekdays' as FrequencyType,
      days_of_week = [1, 2, 3, 4, 5],
      batch_total_servings,
      week_start_date,
      also_for_partner = false,
    } = body;

    const user = db.profiles.find((p) => p.id === userId);
    const partner = db.profiles.find(
      (p) => user?.household_id && p.household_id === user.household_id && p.id !== userId
    );

    const dish = db.dishes.find((d) => d.id === dish_id);
    if (!dish) {
      return NextResponse.json({ error: 'Platillo no encontrado' }, { status: 404 });
    }

    const targetWeek = week_start_date || getSmartMealPrepWeekStartDate();

    // 1. Crear registro de regla de consumo
    const newSchedule: ConsumptionSchedule = {
      id: crypto.randomUUID(),
      user_id: userId,
      dish_id,
      food_id: null,
      meal_type,
      frequency_type,
      days_of_week,
      batch_total_servings: batch_total_servings || dish.total_servings,
      batch_servings_remaining: batch_total_servings || dish.total_servings,
      start_date: getLocalDateString(),
      end_date: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await insertRow('consumption_schedules', newSchedule);

    // 2. Aplicar automáticamente a la planeación semanal (meal_plans)
    let targetDays: number[] = [];

    if (frequency_type === 'daily') {
      targetDays = [1, 2, 3, 4, 5, 6, 7];
    } else if (frequency_type === 'weekdays') {
      targetDays = [1, 2, 3, 4, 5];
    } else if (frequency_type === 'specific_days') {
      targetDays = days_of_week;
    } else if (frequency_type === 'meal_prep_batch') {
      // Repartir N porciones en días hábiles consecutivos
      const servings = Math.min(7, Number(batch_total_servings) || dish.total_servings);
      for (let i = 1; i <= servings; i++) {
        targetDays.push(i);
      }
    }

    const userIdsToPlan = [userId];
    if (also_for_partner && partner) {
      userIdsToPlan.push(partner.id);
    }

    // Limpiar planes anteriores de este mismo platillo para evitar duplicados o residuos en la semana actual/siguiente
    const cleanPrefix = `${dish.name.trim().toLowerCase()} (`;
    const toRemove = db.meal_plans.filter(
      (p) =>
        userIdsToPlan.includes(p.user_id) &&
        (p.week_start_date === targetWeek || (targetWeek !== getWeekStartDate() && p.week_start_date === getWeekStartDate())) &&
        (p.custom_name.trim().toLowerCase().startsWith(cleanPrefix) || p.custom_name.trim().toLowerCase() === dish.name.trim().toLowerCase())
    );
    for (const old of toRemove) {
      await deleteRow('meal_plans', old.id);
    }

    let addedToPlan = 0;
    for (const targetUserId of userIdsToPlan) {
      for (const day of targetDays) {
        const newPlanItem = {
          id: crypto.randomUUID(),
          user_id: targetUserId,
          week_start_date: targetWeek,
          day_of_week: day,
          meal_type,
          food_id: null,
          custom_name: `${dish.name} (1 ${dish.serving_name})`,
          servings: 1,
          calories: dish.calories_per_serving,
          protein_g: dish.protein_per_serving,
          carbs_g: dish.carbs_per_serving,
          fat_g: dish.fat_per_serving,
          created_at: new Date().toISOString(),
        };
        await insertRow('meal_plans', newPlanItem);
        addedToPlan++;
      }
    }

    const partnerNotice = also_for_partner && partner ? ` (incluyendo el plan de ${partner.display_name})` : '';

    return NextResponse.json({
      success: true,
      schedule: newSchedule,
      addedToPlan,
      message: `Se programaron ${targetDays.length} comida(s) en tu plan semanal${partnerNotice}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al programar frecuencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
