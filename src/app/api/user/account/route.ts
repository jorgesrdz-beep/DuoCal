import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb, deleteRow } from '@/lib/store/mockDb';

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();

    // Borrado en cascada de todos los datos del usuario
    await deleteRow('profiles', userId);
    db.goals = db.goals.filter((g) => g.user_id !== userId);
    db.food_logs = db.food_logs.filter((l) => l.user_id !== userId);
    db.meal_plans = db.meal_plans.filter((p) => p.user_id !== userId);
    db.health_metrics = db.health_metrics.filter((m) => m.user_id !== userId);
    db.dishes = db.dishes.filter((d) => d.user_id !== userId);

    cookieStore.delete('duocal_session');

    return NextResponse.json({ success: true, message: 'Cuenta y datos eliminados por completo.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar cuenta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
