import { NextResponse } from 'next/server';
import { getDb, insertRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    const db = await getDb();
    const foods = db.foods.filter((f) => f.user_id === null || f.user_id === userId);
    return NextResponse.json({ foods });
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
    const { name, brand, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, barcode, source } = body;

    if (!name || calories === undefined) {
      return NextResponse.json({ error: 'Nombre y calorías son requeridos' }, { status: 400 });
    }

    const db = await getDb();
    const newFood = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      brand: brand?.trim() || null,
      serving_size_g: Number(serving_size_g) || 100,
      serving_unit: serving_unit || 'g',
      calories: Number(calories),
      protein_g: Number(protein_g) || 0,
      carbs_g: Number(carbs_g) || 0,
      fat_g: Number(fat_g) || 0,
      source: source || 'manual',
      barcode: barcode?.trim() || null,
      is_verified: false,
      created_at: new Date().toISOString(),
    };

    await insertRow('foods', newFood);
    return NextResponse.json({ success: true, food: newFood });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar alimento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
