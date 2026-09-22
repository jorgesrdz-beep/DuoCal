import { NextResponse } from 'next/server';
import { getDb, insertRow } from '@/lib/store/mockDb';
import { isServiceRoleConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getWeekStartDate } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      week_start_date = getWeekStartDate(),
      source_day = 1, // Por defecto Lunes
      target_days = [2, 3, 4, 5], // Días destino
      meal_types = ['breakfast', 'lunch', 'dinner', 'snack'], // qué comidas duplicar
    } = body;

    const cleanTargetDays = Array.isArray(target_days)
      ? target_days.map(Number).filter((d) => d >= 1 && d <= 7 && d !== Number(source_day))
      : [];

    if (cleanTargetDays.length === 0) {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos un día destino para duplicar el plan.' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Obtener los items del día fuente
    const rawSourceItems = db.meal_plans.filter(
      (p) =>
        p.user_id === userId &&
        p.week_start_date === week_start_date &&
        p.day_of_week === Number(source_day) &&
        meal_types.includes(p.meal_type)
    );

    if (rawSourceItems.length === 0) {
      return NextResponse.json(
        { error: 'El día seleccionado como origen no tiene comidas planeadas para duplicar.' },
        { status: 400 }
      );
    }

    // Asegurar que no existan items repetidos idénticos dentro del mismo día origen
    const sourceItems: typeof rawSourceItems = [];
    const seenKeys = new Set<string>();
    for (const item of rawSourceItems) {
      const key = `${item.meal_type}_${item.custom_name.trim().toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        sourceItems.push(item);
      }
    }

    // 1. Limpiar completamente los días destino en Supabase en una sola consulta atómica
    if (isServiceRoleConfigured) {
      const { error: delErr } = await supabaseAdmin
        .from('meal_plans')
        .delete()
        .eq('user_id', userId)
        .eq('week_start_date', week_start_date)
        .in('day_of_week', cleanTargetDays)
        .in('meal_type', meal_types);

      if (delErr) {
        console.error('Error eliminando comidas previas en Supabase:', delErr);
      }
    }

    // 2. Limpiar en memoria
    db.meal_plans = db.meal_plans.filter(
      (p) =>
        !(
          p.user_id === userId &&
          p.week_start_date === week_start_date &&
          cleanTargetDays.includes(p.day_of_week) &&
          meal_types.includes(p.meal_type)
        )
    );

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const getValidFoodId = (foodId: any) =>
      foodId && typeof foodId === 'string' && isUuid(foodId) && db.foods.some((f) => f.id === foodId)
        ? foodId
        : null;

    // 3. Insertar réplicas exactas en cada día destino
    let addedCount = 0;
    for (const targetDay of cleanTargetDays) {
      for (const item of sourceItems) {
        const copyItem = {
          id: crypto.randomUUID(),
          user_id: userId,
          week_start_date: week_start_date,
          day_of_week: targetDay,
          meal_type: item.meal_type,
          food_id: getValidFoodId(item.food_id),
          custom_name: item.custom_name,
          servings: Number(item.servings) || 1,
          calories: Math.round(Number(item.calories)),
          protein_g: Number(Number(item.protein_g || 0).toFixed(1)),
          carbs_g: Number(Number(item.carbs_g || 0).toFixed(1)),
          fat_g: Number(Number(item.fat_g || 0).toFixed(1)),
          created_at: new Date().toISOString(),
        };
        await insertRow('meal_plans', copyItem);
        addedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      addedCount,
      message: `Se han replicado ${sourceItems.length} comida(s) a ${cleanTargetDays.length} día(s) con éxito sin duplicados.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al duplicar plan';
    console.error('Error in /api/meal-plans/duplicate:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
