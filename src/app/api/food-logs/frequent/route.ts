import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import { FrequentItem } from '@/types/database';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const userLogs = db.food_logs.filter((l) => l.user_id === userId);

    // Contar ocurrencias por food_name
    const freqMap: Map<string, { log: typeof userLogs[0]; count: number }> = new Map();

    for (const log of userLogs) {
      const key = log.food_name.toLowerCase().trim();
      if (freqMap.has(key)) {
        freqMap.get(key)!.count += 1;
      } else {
        freqMap.set(key, { log, count: 1 });
      }
    }

    // Ordenar de más frecuente a menos
    const sorted = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);

    let frequentItems: FrequentItem[] = sorted.slice(0, 6).map(({ log, count }) => ({
      id: 'freq-' + log.id,
      name: log.food_name,
      meal_type: log.meal_type,
      type: log.food_name.includes('(') ? 'dish' : 'food',
      calories: log.calories,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
      amount_g: log.amount_g,
      times_logged: count,
    }));

    // Si el usuario es nuevo o tiene pocos registros, agregar recomendaciones rápidas frecuentes
    if (frequentItems.length < 3) {
      const defaults: FrequentItem[] = [
        {
          id: 'def-1',
          name: 'Huevos enteros revueltos (2 pzas)',
          meal_type: 'breakfast',
          type: 'food',
          calories: 143,
          protein_g: 12.6,
          carbs_g: 0.7,
          fat_g: 9.5,
          amount_g: 100,
          times_logged: 5,
        },
        {
          id: 'def-2',
          name: 'Bowl de Pollo, Arroz y Aguacate',
          meal_type: 'lunch',
          type: 'dish',
          calories: 460,
          protein_g: 49,
          carbs_g: 35,
          fat_g: 11,
          amount_g: 300,
          portion_name: 'recipiente',
          times_logged: 4,
        },
        {
          id: 'def-3',
          name: 'Avena con Proteína y Berries',
          meal_type: 'breakfast',
          type: 'dish',
          calories: 340,
          protein_g: 29,
          carbs_g: 37,
          fat_g: 6,
          amount_g: 250,
          portion_name: 'frasco',
          times_logged: 3,
        },
        {
          id: 'def-4',
          name: 'Pechuga a la plancha con ensalada',
          meal_type: 'dinner',
          type: 'food',
          calories: 220,
          protein_g: 38,
          carbs_g: 4,
          fat_g: 4,
          amount_g: 200,
          times_logged: 3,
        },
      ];

      for (const d of defaults) {
        if (!frequentItems.some((f) => f.name.toLowerCase() === d.name.toLowerCase())) {
          frequentItems.push(d);
        }
      }
    }

    return NextResponse.json({ frequentItems: frequentItems.slice(0, 6) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
