import { NextResponse } from 'next/server';
import { getDb, insertRow, deleteRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();

    let logs = db.food_logs.filter((l) => l.user_id === userId);

    if (startDate && endDate) {
      logs = logs.filter((l) => l.date >= startDate && l.date <= endDate);
    } else {
      logs = logs.filter((l) => l.date === date);
    }

    // Totales del día o rango
    const totals = logs.reduce(
      (acc, curr) => ({
        calories: acc.calories + curr.calories,
        protein_g: acc.protein_g + curr.protein_g,
        carbs_g: acc.carbs_g + curr.carbs_g,
        fat_g: acc.fat_g + curr.fat_g,
        fiber_g: acc.fiber_g + (curr.fiber_g || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
    );

    return NextResponse.json({
      logs,
      totals: {
        calories: Math.round(totals.calories),
        protein_g: Number(totals.protein_g.toFixed(1)),
        carbs_g: Number(totals.carbs_g.toFixed(1)),
        fat_g: Number(totals.fat_g.toFixed(1)),
        fiber_g: Number(totals.fiber_g.toFixed(1)),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener registros';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { date, meal_type, food_id, food_name, amount_g, calories, protein_g, carbs_g, fat_g } = body;

    if (!food_name || calories === undefined || !amount_g) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const db = await getDb();

    const newLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      date: date || new Date().toISOString().split('T')[0],
      meal_type: meal_type || 'lunch',
      food_id: food_id || null,
      food_name: food_name.trim(),
      amount_g: Number(amount_g),
      calories: Math.round(Number(calories)),
      protein_g: Number(Number(protein_g || 0).toFixed(1)),
      carbs_g: Number(Number(carbs_g || 0).toFixed(1)),
      fat_g: Number(Number(fat_g || 0).toFixed(1)),
      fiber_g: Number(Number(body.fiber_g || 0).toFixed(1)),
      created_at: new Date().toISOString(),
    };

    await insertRow('food_logs', newLog);

    return NextResponse.json({ success: true, log: newLog });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar comida';
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
    const existing = db.food_logs.find((l) => l.id === id && l.user_id === userId);
    if (!existing) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    await deleteRow('food_logs', id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
