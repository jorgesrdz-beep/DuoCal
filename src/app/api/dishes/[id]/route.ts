import { NextResponse } from 'next/server';
import { getDb, deleteRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const dish = db.dishes.find((d) => d.id === id);
    if (!dish) return NextResponse.json({ error: 'Platillo no encontrado' }, { status: 404 });

    const ingredients = db.dish_ingredients.filter((di) => di.dish_id === dish.id);

    return NextResponse.json({
      dish: {
        ...dish,
        ingredients,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const existing = db.dishes.find((d) => d.id === id && d.user_id === userId);
    if (!existing) {
      return NextResponse.json({ error: 'Platillo no encontrado o sin permisos' }, { status: 404 });
    }

    await deleteRow('dishes', id);
    db.dish_ingredients = db.dish_ingredients.filter((di) => di.dish_id !== id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar platillo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
