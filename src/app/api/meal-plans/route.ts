import { NextResponse } from 'next/server';
import { getDb, insertRow, deleteRow } from '@/lib/store/mockDb';
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

    const newItem = {
      id: crypto.randomUUID(),
      user_id: userId,
      week_start_date: week_start_date || getWeekStartDate(),
      day_of_week: Number(day_of_week),
      meal_type,
      food_id: food_id || null,
      custom_name: custom_name.trim(),
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
