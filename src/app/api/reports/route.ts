import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/store/mockDb';
import { getLocalDateString, shiftDateDays } from '@/lib/utils';
import { getWaterIntakeSync } from '@/lib/store/waterStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'weekly'; // 'weekly' (last 7 days), 'monthly' (last 30 days)
    const clientDate = searchParams.get('date') || getLocalDateString();

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === userId);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const daysCount = range === 'monthly' ? 30 : 7;

    // Generar lista de días usando fecha local real
    const dates: string[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      dates.push(shiftDateDays(clientDate, -i));
    }

    const activeGoal = db.goals.find((g) => g.user_id === userId && g.is_active);
    const calorieTarget = activeGoal?.calorie_target || 2000;
    const proteinTarget = activeGoal?.protein_target_g || 140;

    // Métricas por día
    const dailyData = dates.map((dateStr) => {
      const logs = db.food_logs.filter((l) => l.user_id === userId && l.date === dateStr);
      const consumedCals = logs.reduce((sum, item) => sum + item.calories, 0);
      const consumedProtein = logs.reduce((sum, item) => sum + item.protein_g, 0);
      const consumedCarbs = logs.reduce((sum, item) => sum + item.carbs_g, 0);
      const consumedFat = logs.reduce((sum, item) => sum + item.fat_g, 0);

      const health = db.health_metrics.find((h) => h.user_id === userId && h.date === dateStr);
      const activeBurned = health?.active_calories_burned || 0;
      const steps = health?.steps || 0;
      const weight = health?.weight_kg || user.current_weight_kg;

      // Balance energético real: Consumo - (TDEE base o calorías activas del Watch)
      const netBalance = consumedCals > 0 ? consumedCals - calorieTarget : 0;

      return {
        date: dateStr,
        dayLabel: new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        calories: consumedCals,
        targetCalories: calorieTarget,
        protein: Math.round(consumedProtein),
        targetProtein: proteinTarget,
        carbs: Math.round(consumedCarbs),
        fat: Math.round(consumedFat),
        activeBurned,
        steps,
        weight,
        netBalance,
        water_ml: db.water_logs?.find((w) => w.user_id === userId && w.date === dateStr)?.water_ml ?? getWaterIntakeSync(userId, dateStr),
        goalType: activeGoal?.goal_type || 'maintenance',
      };
    });

    // Balance Semanal Acumulado (Promedio de 7 días vs Meta)
    const loggedDays = dailyData.filter((d) => d.calories > 0);
    const count = loggedDays.length || 1;
    const weeklyAverageCalories = Math.round(loggedDays.reduce((acc, d) => acc + d.calories, 0) / count);
    const weeklyAverageProtein = Math.round(loggedDays.reduce((acc, d) => acc + d.protein, 0) / count);
    const weeklyCalorieDifference = weeklyAverageCalories - calorieTarget;

    // Resumen Compartido de Pareja (General, sin exponer alimentos específicos)
    let partnerSummary = null;
    if (user.household_id) {
      const partner = db.profiles.find(
        (p) => p.household_id === user.household_id && p.id !== user.id
      );

      if (partner) {
        const partnerGoal = db.goals.find((g) => g.user_id === partner.id && g.is_active);
        const partnerTargetCals = partnerGoal?.calorie_target || 2000;
        const partnerTargetProt = partnerGoal?.protein_target_g || 120;

        const partnerLogs = db.food_logs.filter(
          (l) => l.user_id === partner.id && dates.includes(l.date)
        );

        // Agrupar por días registrados
        const partnerDaysMap = new Map<string, number>();
        partnerLogs.forEach((l) => {
          partnerDaysMap.set(l.date, (partnerDaysMap.get(l.date) || 0) + l.calories);
        });

        const pCount = partnerDaysMap.size || 1;
        let pTotal = 0;
        partnerDaysMap.forEach((v) => (pTotal += v));

        const partnerTodayLogs = db.food_logs.filter((l) => l.user_id === partner.id && l.date === dates[dates.length - 1]);
        const partnerTodayCalories = partnerTodayLogs.reduce((sum, item) => sum + item.calories, 0);

        partnerSummary = {
          partnerName: partner.display_name,
          goalType: partnerGoal?.goal_type || 'maintenance',
          targetCalories: partnerTargetCals,
          targetProtein: partnerTargetProt,
          averageCalories: Math.round(pTotal / pCount),
          daysLoggedCount: partnerDaysMap.size,
          todayCalories: partnerTodayCalories,
          sharePhotosAllowed: partner.share_photos_with_partner,
        };
      }
    }

    // Balance Diario de Hoy
    const todayStr = dates[dates.length - 1];
    const userTodayLogs = db.food_logs.filter((l) => l.user_id === userId && l.date === todayStr);
    const userTodayCals = userTodayLogs.reduce((sum, l) => sum + l.calories, 0);
    const userTodayProt = userTodayLogs.reduce((sum, l) => sum + l.protein_g, 0);
    const userTodayCarbs = userTodayLogs.reduce((sum, l) => sum + l.carbs_g, 0);
    const userTodayFat = userTodayLogs.reduce((sum, l) => sum + l.fat_g, 0);
    const userTodayFiber = userTodayLogs.reduce((sum, l) => sum + (l.fiber_g || 0), 0);

    const todayBalance = {
      date: todayStr,
      user: {
        calories: userTodayCals,
        targetCalories: calorieTarget,
        remainingCalories: calorieTarget - userTodayCals,
        difference: userTodayCals - calorieTarget,
        protein: Math.round(userTodayProt),
        targetProtein: proteinTarget,
        carbs: Math.round(userTodayCarbs),
        targetCarbs: activeGoal?.carbs_target_g || 200,
        fat: Math.round(userTodayFat),
        targetFat: activeGoal?.fat_target_g || 65,
        fiber: Number(userTodayFiber.toFixed(1)),
        targetFiber: activeGoal?.fiber_target_g || (user.gender === 'female' ? 25 : 30),
        waterTarget: activeGoal?.water_target_ml || Math.round((user.current_weight_kg || 70) * 35),
        waterIntake: db.water_logs?.find((w) => w.user_id === userId && w.date === todayStr)?.water_ml ?? getWaterIntakeSync(userId, todayStr),
      },
      partner: partnerSummary ? {
        name: partnerSummary.partnerName,
        calories: partnerSummary.todayCalories,
        targetCalories: partnerSummary.targetCalories,
        remainingCalories: partnerSummary.targetCalories - partnerSummary.todayCalories,
        difference: partnerSummary.todayCalories - partnerSummary.targetCalories,
        percent: Math.min(100, Math.round((partnerSummary.todayCalories / partnerSummary.targetCalories) * 100)),
      } : null,
    };

    return NextResponse.json({
      dailyData,
      todayBalance,
      weeklySummary: {
        averageCalories: weeklyAverageCalories,
        targetCalories: calorieTarget,
        difference: weeklyCalorieDifference,
        averageProtein: weeklyAverageProtein,
        targetProtein: proteinTarget,
        loggedDaysCount: loggedDays.length,
        status:
          Math.abs(weeklyCalorieDifference) <= 100
            ? 'En balance óptimo'
            : weeklyCalorieDifference > 100
            ? 'Por encima de la meta semanal'
            : 'En déficit sobre la meta semanal',
      },
      partnerSummary,
      activeGoal,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar reporte';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
