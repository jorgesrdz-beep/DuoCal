import { NextResponse } from 'next/server';
import { getDb, insertRow, updateRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import { calculateGoalMacros } from '@/lib/tdee';
import crypto from 'crypto';
import { GoalType } from '@/types/database';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const userGoals = db.goals
      .filter((g) => g.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ goals: userGoals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener metas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const body = await req.json();
    const { goal_type, custom_deficit_pct, notes, updated_weight_kg } = body;

    // Si se actualizó el peso actual, actualizarlo en el perfil
    if (updated_weight_kg && Number(updated_weight_kg) > 0) {
      user.current_weight_kg = Number(updated_weight_kg);
      await updateRow('profiles', user.id, { current_weight_kg: user.current_weight_kg });
    }

    const weight = user.current_weight_kg || 70;
    const height = user.height_cm || 170;
    const age = user.age || 25;
    const gender = user.gender || 'male';
    const activity_level = user.activity_level || 'moderate';

    // Desactivar metas anteriores
    for (const g of db.goals) {
      if (g.user_id === userId && g.is_active) {
        g.is_active = false;
        g.end_date = new Date().toISOString().split('T')[0];
        await updateRow('goals', g.id, { is_active: false, end_date: g.end_date });
      }
    }

    const macros = calculateGoalMacros(
      { age, gender, height_cm: height, weight_kg: weight, activity_level },
      goal_type as GoalType,
      custom_deficit_pct !== undefined ? Number(custom_deficit_pct) : undefined
    );

    const newGoal = {
      id: crypto.randomUUID(),
      user_id: userId,
      goal_type: goal_type as GoalType,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      suggested_duration_weeks: macros.suggested_duration_weeks,
      tdee_calculated: macros.tdee,
      calorie_target: macros.calorie_target,
      deficit_surplus_pct: macros.deficit_surplus_pct,
      protein_target_g: macros.protein_target_g,
      carbs_target_g: macros.carbs_target_g,
      fat_target_g: macros.fat_target_g,
      fiber_target_g: macros.fiber_target_g,
      water_target_ml: macros.water_target_ml,
      initial_weight_kg: weight,
      is_active: true,
      notes: notes || `Meta configurada a partir de peso actual ${weight} kg`,
      created_at: new Date().toISOString(),
    };

    await insertRow('goals', newGoal);

    return NextResponse.json({ success: true, goal: newGoal, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar meta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
