import { NextResponse } from 'next/server';
import { getDb, insertRow } from '@/lib/store/mockDb';
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
      target_days = [2, 3, 4, 5], // Por defecto Martes a Viernes
      meal_types = ['breakfast', 'lunch', 'dinner', 'snack'], // qué comidas duplicar
    } = body;

    const db = await getDb();

    // Obtener los items del día fuente
    const sourceItems = db.meal_plans.filter(
      (p) =>
        p.user_id === userId &&
        p.week_start_date === week_start_date &&
        p.day_of_week === Number(source_day) &&
        meal_types.includes(p.meal_type)
    );

    if (sourceItems.length === 0) {
      return NextResponse.json(
        { error: 'El día seleccionado como origen no tiene comidas planeadas para duplicar.' },
        { status: 400 }
      );
    }

    // Para cada día destino, eliminar comidas existentes del mismo meal_type y clonar los items fuente
    let addedCount = 0;
    for (const targetDay of target_days) {
      if (targetDay === Number(source_day)) continue;

      // Limpiar existentes en los mismos meal_types para evitar duplicidad
      db.meal_plans = db.meal_plans.filter(
        (p) =>
          !(
            p.user_id === userId &&
            p.week_start_date === week_start_date &&
            p.day_of_week === targetDay &&
            meal_types.includes(p.meal_type)
          )
      );

      // Insertar copias
      for (const item of sourceItems) {
        const copyItem = {
          ...item,
          id: crypto.randomUUID(),
          day_of_week: targetDay,
          created_at: new Date().toISOString(),
        };
        await insertRow('meal_plans', copyItem);
        addedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      addedCount,
      message: `Se han replicado ${sourceItems.length} comida(s) a los días seleccionados con éxito.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al duplicar plan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
