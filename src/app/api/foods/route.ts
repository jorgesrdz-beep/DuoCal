import { NextResponse } from 'next/server';
import { getDb, insertRow, updateRow, deleteRow } from '@/lib/store/mockDb';
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
    const { name, brand, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, barcode, source } = body;

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
      fiber_g: Number(fiber_g) || 0,
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

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { id, name, brand, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, barcode } = body;

    if (!name || calories === undefined) {
      return NextResponse.json({ error: 'Nombre y calorías son requeridos' }, { status: 400 });
    }

    const db = await getDb();
    const existing = db.foods.find((f) => f.id === id);

    // Si es un alimento base (user_id === null) o no existe, usamos su ID si existe para que reemplace al alimento base
    if (!existing || existing.user_id === null) {
      const targetId = (existing && existing.id) ? existing.id : crypto.randomUUID();
      const newCustom = {
        id: targetId,
        user_id: userId,
        name: name.trim(),
        brand: brand?.trim() || null,
        serving_size_g: Number(serving_size_g) || 100,
        serving_unit: serving_unit || 'g',
        calories: Number(calories),
        protein_g: Number(protein_g) || 0,
        carbs_g: Number(carbs_g) || 0,
        fat_g: Number(fat_g) || 0,
        fiber_g: Number(fiber_g) || 0,
        source: 'manual' as const,
        barcode: barcode?.trim() || null,
        is_verified: false,
        created_at: new Date().toISOString(),
      };
      await insertRow('foods', newCustom);
      return NextResponse.json({ success: true, food: newCustom });
    }

    // Si ya era un alimento propio del usuario, lo actualizamos
    const updates = {
      name: name.trim(),
      brand: brand?.trim() || null,
      serving_size_g: Number(serving_size_g) || 100,
      serving_unit: serving_unit || 'g',
      calories: Number(calories),
      protein_g: Number(protein_g) || 0,
      carbs_g: Number(carbs_g) || 0,
      fat_g: Number(fat_g) || 0,
      fiber_g: Number(fiber_g) || 0,
      barcode: barcode?.trim() || null,
    };

    await updateRow('foods', id, updates);
    return NextResponse.json({ success: true, food: { ...existing, ...updates } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar alimento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'ID de alimento requerido' }, { status: 400 });
    }

    const db = await getDb();
    const food = db.foods.find((f) => f.id === id && f.user_id === userId);
    if (!food) {
      return NextResponse.json({ error: 'Alimento no encontrado o sin permisos' }, { status: 404 });
    }

    await deleteRow('foods', id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar alimento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

