import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/store/mockDb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const profile = db.profiles.find((p) => p.id === userId);
    const goals = db.goals.filter((g) => g.user_id === userId);
    const foodLogs = db.food_logs.filter((l) => l.user_id === userId);
    const mealPlans = db.meal_plans.filter((p) => p.user_id === userId);
    const healthMetrics = db.health_metrics.filter((m) => m.user_id === userId);

    if (format === 'csv') {
      // Formato CSV para registros de comida
      let csv = 'Fecha,Comida,Alimento,Gramos,Calorias,Proteina(g),Carbos(g),Grasa(g)\n';
      foodLogs.forEach((l) => {
        csv += `"${l.date}","${l.meal_type}","${l.food_name.replace(/"/g, '""')}",${l.amount_g},${l.calories},${l.protein_g},${l.carbs_g},${l.fat_g}\n`;
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="duocal-food-logs-${userId}.csv"`,
        },
      });
    }

    // JSON completo
    const exportData = {
      export_date: new Date().toISOString(),
      profile: profile ? { ...profile, pin_hash: undefined } : null,
      goals,
      food_logs: foodLogs,
      meal_plans: mealPlans,
      health_metrics: healthMetrics,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="duocal-data-export-${userId}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al exportar datos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
