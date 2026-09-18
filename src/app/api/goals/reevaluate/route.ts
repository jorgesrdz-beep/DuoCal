import { NextResponse } from 'next/server';
import { getDb, insertRow, updateRow } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';
import { evaluateProgressAndSuggestAdjustment, calculateGoalMacros } from '@/lib/tdee';
import crypto from 'crypto';
import { GoalType } from '@/types/database';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const activeGoal = db.goals.find((g) => g.user_id === userId && g.is_active);
    if (!activeGoal) {
      return NextResponse.json({
        hasActiveGoal: false,
        message: 'No tienes ninguna meta activa actualmente. Configura una para comenzar el seguimiento adaptativo.',
      });
    }

    // 1. Recopilar registros de peso (de health_metrics y mediciones)
    const userMetrics = db.health_metrics
      .filter((m) => m.user_id === userId && m.weight_kg !== null && m.weight_kg !== undefined)
      .map((m) => ({
        date: m.date,
        weight_kg: Number(m.weight_kg),
      }));

    // Si no hay métricas de salud registradas, usar el peso de referencia actual y peso inicial de la meta
    if (userMetrics.length === 0 && user.current_weight_kg) {
      userMetrics.push({
        date: new Date().toISOString().split('T')[0],
        weight_kg: user.current_weight_kg,
      });
      if (activeGoal.initial_weight_kg) {
        userMetrics.push({
          date: activeGoal.start_date,
          weight_kg: activeGoal.initial_weight_kg,
        });
      }
    }

    // 2. Recopilar registros de alimentos (agrupados por fecha)
    const userFoodLogs = db.food_logs.filter((log) => log.user_id === userId);
    const caloriesByDate: Record<string, number> = {};
    for (const log of userFoodLogs) {
      caloriesByDate[log.date] = (caloriesByDate[log.date] || 0) + (log.calories || 0);
    }

    const foodLogsArray = Object.entries(caloriesByDate).map(([date, calories]) => ({
      date,
      calories,
    }));

    // 3. Ejecutar algoritmo adaptativo
    const evaluation = evaluateProgressAndSuggestAdjustment({
      goal: activeGoal,
      weightHistory: userMetrics,
      calorieLogs: foodLogsArray,
    });

    return NextResponse.json({
      hasActiveGoal: true,
      activeGoal,
      evaluation,
      user: {
        current_weight_kg: user.current_weight_kg,
        neat_level: user.neat_level,
        training_sessions_per_week: user.training_sessions_per_week,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en reevaluación adaptativa';
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

    const activeGoal = db.goals.find((g) => g.user_id === userId && g.is_active);
    if (!activeGoal) return NextResponse.json({ error: 'No hay meta activa para ajustar' }, { status: 400 });

    const body = await req.json();
    const { deltaKcal, reason } = body;

    if (typeof deltaKcal !== 'number' || isNaN(deltaKcal)) {
      return NextResponse.json({ error: 'Ajuste calórico delta inválido' }, { status: 400 });
    }

    // Nuevo objetivo calórico
    const newCalorieTarget = Math.max(
      user.gender === 'female' ? 1200 : 1500,
      activeGoal.calorie_target + deltaKcal
    );

    const weight = user.current_weight_kg || activeGoal.initial_weight_kg || 70;
    const height = user.height_cm || 170;
    const age = user.age || 25;
    const gender = user.gender || 'male';
    const activity_level = user.activity_level || 'moderate';

    // Desactivar meta actual
    activeGoal.is_active = false;
    activeGoal.end_date = new Date().toISOString().split('T')[0];
    await updateRow('goals', activeGoal.id, { is_active: false, end_date: activeGoal.end_date });

    // Recalcular macros manteniendo el nuevo objetivo calórico
    const recalculated = calculateGoalMacros(
      {
        age,
        gender,
        height_cm: height,
        weight_kg: weight,
        activity_level,
        neat_level: user.neat_level || undefined,
        training_sessions_per_week: user.training_sessions_per_week ?? 3,
        daily_steps: user.daily_steps_target ?? undefined,
        macro_preference: activeGoal.macro_preference || 'balanced',
      },
      activeGoal.goal_type as GoalType
    );

    // Si deltaKcal fue aplicado, ajustar las calorías e imputar la diferencia a carbohidratos
    const carbDeltaG = Math.round((newCalorieTarget - recalculated.calorie_target) / 4);
    const finalCarbsG = Math.max(50, recalculated.carbs_target_g + carbDeltaG);

    const newGoal = {
      id: crypto.randomUUID(),
      user_id: userId,
      goal_type: activeGoal.goal_type,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      suggested_duration_weeks: activeGoal.suggested_duration_weeks,
      tdee_calculated: recalculated.tdee,
      calorie_target: newCalorieTarget,
      deficit_surplus_pct: Number(((newCalorieTarget - recalculated.tdee) / recalculated.tdee).toFixed(2)),
      protein_target_g: recalculated.protein_target_g,
      carbs_target_g: finalCarbsG,
      fat_target_g: recalculated.fat_target_g,
      fiber_target_g: recalculated.fiber_target_g,
      water_target_ml: recalculated.water_target_ml,
      initial_weight_kg: weight,
      is_active: true,
      macro_preference: activeGoal.macro_preference || 'balanced',
      target_rate_pct_per_week: recalculated.target_rate_pct_per_week,
      evaluation_period_weeks: recalculated.suggested_duration_weeks,
      re_evaluation_criteria: recalculated.reEvaluationCriteria,
      notes: reason || `Ajuste adaptativo confirmado: ${deltaKcal > 0 ? `+${deltaKcal}` : deltaKcal} kcal respecto a meta previa.`,
      created_at: new Date().toISOString(),
    };

    await insertRow('goals', newGoal);

    return NextResponse.json({ success: true, goal: newGoal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al aplicar reevaluación';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
