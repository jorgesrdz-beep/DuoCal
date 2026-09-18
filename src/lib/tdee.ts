import { ActivityLevel, Gender, GoalType } from '@/types/database';

export interface TDEEInput {
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  neat_level?: 'sedentary' | 'light_standing' | 'active_walking' | 'heavy_labor';
  training_sessions_per_week?: number;
  daily_steps?: number;
  macro_preference?: 'balanced' | 'high_carb' | 'higher_fat';
}

export interface GoalCalculationResult {
  bmr: number;
  tdee: number;
  goal_type: GoalType;
  deficit_surplus_pct: number;
  calorie_target: number;
  protein_target_g: number;
  fat_target_g: number;
  carbs_target_g: number;
  fiber_target_g: number;
  fiber_min_g: number;
  fiber_max_g: number;
  fiber_range_text: string;
  water_target_ml: number;
  water_baseline_ml: number;
  workout_hydration_guide: string;
  min_safe_floor: number;
  is_floor_clamped: boolean;
  protein_ratio_g_per_kg: number;
  fat_ratio_g_per_kg: number;
  suggested_duration_weeks: number;
  evaluation_period_text: string;
  target_loss_rate_text: string;
  target_rate_pct_per_week: number;
  reEvaluationCriteria: string;
  adjusted_weight_kg?: number;
  is_obesity_adjusted: boolean;
  macro_preference: 'balanced' | 'high_carb' | 'higher_fat';
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // Poco o nada de ejercicio
  light: 1.375,         // Ejercicio ligero 1-3 días/sem
  moderate: 1.55,       // Ejercicio moderado 3-5 días/sem
  very_active: 1.725,   // Ejercicio fuerte 6-7 días/sem
  extra_active: 1.9,    // Ejercicio muy fuerte o trabajo físico intenso
};

/**
 * Calcula el factor de actividad desacoplado:
 * Separa el NEAT cotidiano (trabajo/pasos) de las sesiones de entrenamiento reales
 */
export function calculateActivityFactor(
  neatLevel: 'sedentary' | 'light_standing' | 'active_walking' | 'heavy_labor' = 'sedentary',
  workoutSessionsPerWeek: number = 3,
  dailySteps?: number
): number {
  let baseNeat = 1.18;
  if (dailySteps !== undefined && dailySteps > 0) {
    if (dailySteps < 5000) baseNeat = 1.15;
    else if (dailySteps < 8000) baseNeat = 1.25;
    else if (dailySteps < 12000) baseNeat = 1.35;
    else baseNeat = 1.48;
  } else {
    switch (neatLevel) {
      case 'sedentary': baseNeat = 1.16; break; // Oficina / sentado >7h
      case 'light_standing': baseNeat = 1.25; break; // De pie frecuente (docente, mostrador)
      case 'active_walking': baseNeat = 1.35; break; // Camina continuo (mesero, enfermero)
      case 'heavy_labor': baseNeat = 1.50; break; // Esfuerzo físico constante (construcción, almacén)
    }
  }

  // Cada sesión semanal de entrenamiento de fuerza/cardio de 45-60 min añade ~0.035 al gasto semanal
  const workoutAddition = Math.min(0.35, Math.max(0, workoutSessionsPerWeek) * 0.035);
  return Number((baseNeat + workoutAddition).toFixed(3));
}

/**
 * Calcula el BMR usando la ecuación de Mifflin-St Jeor
 */
export function calculateBMR(gender: Gender, weight_kg: number, height_cm: number, age: number): number {
  if (gender === 'female') {
    return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161);
  }
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5);
}

/**
 * Calcula el TDEE (Gasto Energético Diario Total)
 */
export function calculateTDEE(input: TDEEInput): number {
  const bmr = calculateBMR(input.gender, input.weight_kg, input.height_cm, input.age);
  
  let factor = ACTIVITY_MULTIPLIERS[input.activity_level] || 1.2;
  if (input.neat_level || input.training_sessions_per_week !== undefined || input.daily_steps !== undefined) {
    factor = calculateActivityFactor(
      input.neat_level || 'sedentary',
      input.training_sessions_per_week !== undefined ? input.training_sessions_per_week : 3,
      input.daily_steps
    );
  }

  return Math.round(bmr * factor);
}

/**
 * Calcula los objetivos según el tipo de meta seleccionada:
 * - Definición: inicio por defecto en -15% (rango -10% a -25%), 1.8-2.2 g/kg proteína
 * - Recomposición: inicio en -5% (rango 0% a -10%), 1.8-2.0 g/kg proteína
 * - Mantenimiento: 0%, 1.7-1.8 g/kg proteína
 * - Volumen: inicio en +8% (rango +5% a +12%), 1.8 g/kg proteína
 */
export function calculateGoalMacros(
  input: TDEEInput,
  goal_type: GoalType,
  customDeficitPct?: number
): GoalCalculationResult {
  const bmr = calculateBMR(input.gender, input.weight_kg, input.height_cm, input.age);
  const tdee = calculateTDEE(input);

  let deficit_surplus_pct = 0;
  let protein_ratio = 2.0;
  let base_fat_ratio = 0.8;
  let suggested_duration_weeks = 12;
  let evaluation_period_text = '8 – 12 semanas';
  let target_loss_rate_text = '0.4% a 0.7% del peso por semana';
  let target_rate_pct_per_week = 0.5;
  let criteria = '';

  switch (goal_type) {
    case 'definition':
      // Inicio en -15% por defecto para evaluar adherencia, hambre y fuerza antes de apretar
      deficit_surplus_pct = customDeficitPct !== undefined 
        ? Math.max(-0.25, Math.min(-0.10, customDeficitPct))
        : -0.15;
      protein_ratio = 2.0;
      base_fat_ratio = 0.75;
      suggested_duration_weeks = 12;
      evaluation_period_text = 'Periodo de evaluación inicial: 8 – 12 semanas';
      target_loss_rate_text = 'Ritmo óptimo: 0.4% a 0.7% del peso corporal / semana';
      target_rate_pct_per_week = -0.5;
      criteria = 'Observar pérdida de 0.4–0.7% semanal y rendimiento en fuerza. Si tras 2–3 semanas con buena adherencia la pérdida es <0.3%, ajustar a -20%.';
      break;

    case 'recomposition':
      // Inicio en -5% por defecto (rango configurable 0% a -10%)
      deficit_surplus_pct = customDeficitPct !== undefined
        ? Math.max(-0.10, Math.min(0.0, customDeficitPct))
        : -0.05;
      protein_ratio = 1.9;
      base_fat_ratio = 0.80;
      suggested_duration_weeks = 16;
      evaluation_period_text = 'Periodo de evaluación inicial: 12 – 16 semanas';
      target_loss_rate_text = 'Estabilidad de peso o pérdida leve (0.1% a 0.3% / semana) con reducción de cintura';
      target_rate_pct_per_week = -0.2;
      criteria = 'Evaluar circunferencia de cintura, fuerza progresiva y fotos comparativas cada 3 semanas. Si el peso se estanca sin cambio visual, considerar Definición.';
      break;

    case 'maintenance':
      deficit_surplus_pct = 0.0;
      protein_ratio = 1.75;
      base_fat_ratio = 0.85;
      suggested_duration_weeks = 12;
      evaluation_period_text = 'Fase flexible (Revisión mensual de estabilidad)';
      target_loss_rate_text = 'Estabilidad del promedio móvil de peso dentro de ±0.5%';
      target_rate_pct_per_week = 0.0;
      criteria = 'Monitorear promedio móvil semanal de peso. Si deriva hacia arriba o abajo persistentemente por >2 semanas, reajustar ±100 kcal.';
      break;

    case 'bulking':
      // Inicio en +8% (rango +5% a +12%)
      deficit_surplus_pct = customDeficitPct !== undefined
        ? Math.max(0.05, Math.min(0.12, customDeficitPct))
        : 0.08;
      protein_ratio = 1.8;
      base_fat_ratio = 0.90;
      suggested_duration_weeks = 16;
      evaluation_period_text = 'Periodo de evaluación inicial: 12 – 16 semanas';
      target_loss_rate_text = 'Aumento controlado de 0.25% a 0.5% del peso corporal / semana';
      target_rate_pct_per_week = 0.35;
      criteria = 'Monitorear aumento de fuerza vs aumento de cintura. Si la ganancia de peso supera 0.7% semanal, reducir superávit en 100 kcal.';
      break;
  }

  // Piso Calórico Clínico de Seguridad (OMS/ISSN):
  const min_safe_floor = input.gender === 'female' ? 1200 : 1500;
  const raw_calorie_target = Math.round(tdee * (1 + deficit_surplus_pct));
  const is_floor_clamped = raw_calorie_target < min_safe_floor;
  const calorie_target = Math.max(min_safe_floor, raw_calorie_target);

  // Salvaguarda para sobrepeso marcado / Obesidad (IMC >= 30)
  const heightM = input.height_cm / 100;
  const bmi = input.weight_kg / (heightM * heightM);
  let effectiveWeightForProtein = input.weight_kg;
  let is_obesity_adjusted = false;
  let adjusted_weight_kg: number | undefined;

  if (bmi >= 30) {
    const ibw = 22.5 * (heightM * heightM);
    adjusted_weight_kg = Number((ibw + 0.25 * (input.weight_kg - ibw)).toFixed(1));
    effectiveWeightForProtein = adjusted_weight_kg;
    is_obesity_adjusted = true;
  }

  // Proteína: 4 kcal por gramo
  const protein_target_g = Math.round(effectiveWeightForProtein * protein_ratio);
  const protein_cals = protein_target_g * 4;

  // Preferencia de distribución de macronutrientes: 'balanced' | 'high_carb' | 'higher_fat'
  const macro_preference = input.macro_preference || 'balanced';
  let effectiveFatRatio = base_fat_ratio;

  if (macro_preference === 'high_carb') {
    effectiveFatRatio = Math.max(0.65, base_fat_ratio - 0.10);
  } else if (macro_preference === 'higher_fat') {
    effectiveFatRatio = base_fat_ratio + 0.15;
  }

  // Piso de seguridad fisiológico de grasas (mínimo 0.65 g/kg de peso efectivo o 18% de kcal)
  const raw_fat_target = Math.round(effectiveWeightForProtein * effectiveFatRatio);
  const min_fat_grams = Math.round(effectiveWeightForProtein * 0.65);
  const fat_target_g = Math.max(min_fat_grams, raw_fat_target);
  const fat_cals = fat_target_g * 9;

  // Carbohidratos: 4 kcal por gramo (residuo energético limpio)
  const remaining_cals = Math.max(0, calorie_target - protein_cals - fat_cals);
  const carbs_target_g = Math.round(remaining_cals / 4);

  // Fibra Dietética como Rango Fisiológico (14g por 1,000 kcal con piso por sexo)
  const fiber_base = Math.round((calorie_target / 1000) * 14);
  const fiber_min_g = input.gender === 'female' ? Math.max(25, fiber_base) : Math.max(30, fiber_base);
  const fiber_max_g = fiber_min_g + 5;
  const fiber_target_g = fiber_min_g;
  const fiber_range_text = `${fiber_min_g} – ${fiber_max_g} g`;

  // Hidratación en dos componentes:
  const water_baseline_ml = Math.round(input.weight_kg * 35);
  const water_target_ml = water_baseline_ml;
  const workout_hydration_guide = 'Añadir 400 a 800 ml por cada hora de entrenamiento según intensidad y sudoración.';

  return {
    bmr,
    tdee,
    goal_type,
    deficit_surplus_pct,
    calorie_target,
    protein_target_g,
    fat_target_g,
    carbs_target_g,
    fiber_target_g,
    fiber_min_g,
    fiber_max_g,
    fiber_range_text,
    water_target_ml,
    water_baseline_ml,
    workout_hydration_guide,
    min_safe_floor,
    is_floor_clamped,
    protein_ratio_g_per_kg: protein_ratio,
    fat_ratio_g_per_kg: effectiveFatRatio,
    suggested_duration_weeks,
    evaluation_period_text,
    target_loss_rate_text,
    target_rate_pct_per_week,
    reEvaluationCriteria: criteria,
    adjusted_weight_kg,
    is_obesity_adjusted,
    macro_preference,
  };
}

/**
 * Motor de Reevaluación Adaptativa Longitudinal
 * Compara promedios móviles semanales y adherencia real antes de sugerir cualquier ajuste
 */
export interface AdaptiveProgressInput {
  goal: {
    goal_type: GoalType;
    calorie_target: number;
    initial_weight_kg: number;
    start_date: string;
  };
  weightHistory: { date: string; weight_kg: number }[];
  calorieLogs: { date: string; calories: number }[];
  daysToCheck?: number; // por defecto 14 días
}

export interface AdaptiveProgressEvaluation {
  daysInPhase: number;
  recordedDaysCount: number;
  adherencePct: number;
  avgDailyCalories: number;
  initialWeight: number;
  currentRollingAvgWeight: number;
  previousRollingAvgWeight: number | null;
  weeklyChangeRatePct: number;
  weeklyChangeKg: number;
  status: 'on_track' | 'needs_adjustment' | 'adherence_alert' | 'insufficient_data';
  suggestedAction: 'maintain' | 'decrease_cals' | 'increase_cals' | 'focus_adherence';
  suggestedDeltaKcal: number;
  headline: string;
  diagnosisMessage: string;
  recommendationPrompt: string | null;
}

export function evaluateProgressAndSuggestAdjustment(
  data: AdaptiveProgressInput
): AdaptiveProgressEvaluation {
  const { goal, weightHistory, calorieLogs } = data;
  const initialWeight = goal.initial_weight_kg || 75;

  const startDate = new Date(goal.start_date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const daysInPhase = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Si tiene menos de 7 días o menos de 3 registros, no se pueden calcular promedios confiables
  if (daysInPhase < 7 || weightHistory.length < 3) {
    return {
      daysInPhase,
      recordedDaysCount: weightHistory.length,
      adherencePct: 100,
      avgDailyCalories: goal.calorie_target,
      initialWeight,
      currentRollingAvgWeight: weightHistory[0]?.weight_kg || initialWeight,
      previousRollingAvgWeight: null,
      weeklyChangeRatePct: 0,
      weeklyChangeKg: 0,
      status: 'insufficient_data',
      suggestedAction: 'maintain',
      suggestedDeltaKcal: 0,
      headline: 'Recopilando datos iniciales',
      diagnosisMessage: `Llevas ${daysInPhase} día(s) en esta fase. Se requieren al menos 7 a 14 días de registros continuos para evaluar la tendencia metabólica real sin sesgos de fluctuación de agua.`,
      recommendationPrompt: null,
    };
  }

  // Ordenar pesos descendentes por fecha
  const sortedWeights = [...weightHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Dividir en últimas 2 semanas: días 0-6 (semana actual) vs días 7-13 (semana anterior)
  const recentWeekWeights = sortedWeights.slice(0, 7).map((w) => w.weight_kg);
  const prevWeekWeights = sortedWeights.slice(7, 14).map((w) => w.weight_kg);

  const currentRollingAvgWeight =
    recentWeekWeights.reduce((a, b) => a + b, 0) / recentWeekWeights.length;

  const previousRollingAvgWeight =
    prevWeekWeights.length > 0
      ? prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length
      : initialWeight;

  const weeklyChangeKg = Number((currentRollingAvgWeight - previousRollingAvgWeight).toFixed(2));
  const weeklyChangeRatePct = Number(
    ((weeklyChangeKg / previousRollingAvgWeight) * 100).toFixed(2)
  );

  // Evaluar Adherencia Calórica en los últimos 14 días
  const validCalories = calorieLogs.map((l) => l.calories).filter((c) => c > 500);
  const recordedDaysCount = validCalories.length;
  const avgDailyCalories =
    recordedDaysCount > 0
      ? Math.round(validCalories.reduce((a, b) => a + b, 0) / recordedDaysCount)
      : goal.calorie_target;

  // Adherencia: % de coincidencia respecto a la meta
  const calorieDiff = Math.abs(avgDailyCalories - goal.calorie_target);
  const diffPct = (calorieDiff / goal.calorie_target) * 100;
  const adherencePct = Math.max(0, Math.round(100 - diffPct));

  // Diagnóstico Clínico
  let status: AdaptiveProgressEvaluation['status'] = 'on_track';
  let suggestedAction: AdaptiveProgressEvaluation['suggestedAction'] = 'maintain';
  let suggestedDeltaKcal = 0;
  let headline = 'Progreso en Rango Esperado';
  let diagnosisMessage = '';
  let recommendationPrompt: string | null = null;

  // 1. Si la adherencia es baja (< 75%) o hay menos de 4 días registrados por semana:
  if (adherencePct < 75 || recordedDaysCount < 4) {
    status = 'adherence_alert';
    suggestedAction = 'focus_adherence';
    suggestedDeltaKcal = 0;
    headline = 'Prioridad: Consolidar Adherencia';
    diagnosisMessage = `Tu ingesta calórica promedio real (${avgDailyCalories} kcal) difiere de tu meta (${goal.calorie_target} kcal) o faltan días registrados. Reducir calorías prematuramente sin adherencia generaría fatiga innecesaria.`;
    recommendationPrompt = 'Mantener la meta actual por 7 días más procurando registrar con mayor precisión.';
    return {
      daysInPhase,
      recordedDaysCount,
      adherencePct,
      avgDailyCalories,
      initialWeight,
      currentRollingAvgWeight: Number(currentRollingAvgWeight.toFixed(1)),
      previousRollingAvgWeight: Number(previousRollingAvgWeight.toFixed(1)),
      weeklyChangeRatePct,
      weeklyChangeKg,
      status,
      suggestedAction,
      suggestedDeltaKcal,
      headline,
      diagnosisMessage,
      recommendationPrompt,
    };
  }

  // 2. Evaluación por Fase Nutricional con buena adherencia:
  if (goal.goal_type === 'definition') {
    // Objetivo de pérdida: -0.4% a -0.7% por semana
    if (weeklyChangeRatePct <= -0.35 && weeklyChangeRatePct >= -0.80) {
      status = 'on_track';
      suggestedAction = 'maintain';
      headline = 'Ritmo de Definición Óptimo';
      diagnosisMessage = `Tu pérdida promedio de ${Math.abs(weeklyChangeRatePct)}%/semana (${Math.abs(weeklyChangeKg)} kg) está dentro del rango seguro (0.4%–0.7%). Tu masa muscular y energía están protegidas.`;
    } else if (weeklyChangeRatePct > -0.20) {
      // Estancamiento relativo
      status = 'needs_adjustment';
      suggestedAction = 'decrease_cals';
      suggestedDeltaKcal = -120;
      headline = 'Ritmo por debajo del objetivo';
      diagnosisMessage = `Tu pérdida promedio ha sido de ${weeklyChangeRatePct > 0 ? '+' : ''}${weeklyChangeRatePct}%/sem con una adherencia del ${adherencePct}%. Tu metabolismo se ha adaptado al déficit actual (-15%).`;
      recommendationPrompt = `Ajustar tu meta reduciendo 120 kcal (pasar a ${goal.calorie_target - 120} kcal/día) para reactivar la pérdida de grasa. ¿Deseas aplicar este ajuste?`;
    } else if (weeklyChangeRatePct < -1.0) {
      // Pérdida acelerada (riesgo catabólico)
      status = 'needs_adjustment';
      suggestedAction = 'increase_cals';
      suggestedDeltaKcal = +120;
      headline = 'Pérdida Acelerada (Riesgo Muscular)';
      diagnosisMessage = `Estás perdiendo un ${Math.abs(weeklyChangeRatePct)}%/semana (>1.0%). Una pérdida tan rápida aumenta el riesgo de fatiga, caída de fuerza y pérdida de masa muscular.`;
      recommendationPrompt = `Aumentar preventivamente 120 kcal (pasar a ${goal.calorie_target + 120} kcal/día) para desacelerar la pérdida a un ritmo sostenible. ¿Deseas aplicar este ajuste?`;
    }
  } else if (goal.goal_type === 'bulking') {
    // Objetivo de volumen: +0.25% a +0.50% por semana
    if (weeklyChangeRatePct >= 0.20 && weeklyChangeRatePct <= 0.55) {
      status = 'on_track';
      suggestedAction = 'maintain';
      headline = 'Ganancia Limpia en Rango';
      diagnosisMessage = `Aumento semanal promedio de +${weeklyChangeRatePct}% (+${weeklyChangeKg} kg). Estás construyendo tejido magro con mínima acumulación adiposa.`;
    } else if (weeklyChangeRatePct < 0.15) {
      status = 'needs_adjustment';
      suggestedAction = 'increase_cals';
      suggestedDeltaKcal = +120;
      headline = 'Ganancia de Peso Estancada';
      diagnosisMessage = `Tu peso apenas varió (+${weeklyChangeRatePct}%/sem) con alta adherencia. Tu gasto energético diario superó el superávit inicial.`;
      recommendationPrompt = `Subir 120 kcal al día (a ${goal.calorie_target + 120} kcal) para restablecer el superávit anabólico. ¿Deseas aplicar el ajuste?`;
    } else if (weeklyChangeRatePct > 0.70) {
      status = 'needs_adjustment';
      suggestedAction = 'decrease_cals';
      suggestedDeltaKcal = -100;
      headline = 'Aumento Demasiado Rápido';
      diagnosisMessage = `Ganancia de +${weeklyChangeRatePct}%/semana. A este ritmo, gran parte del excedente se almacena como grasa corporal.`;
      recommendationPrompt = `Moderar el superávit reduciendo 100 kcal (a ${goal.calorie_target - 100} kcal/día). ¿Deseas ajustar?`;
    }
  } else {
    // Recomposición o Mantenimiento
    if (Math.abs(weeklyChangeRatePct) <= 0.40) {
      status = 'on_track';
      suggestedAction = 'maintain';
      headline = 'Estabilidad Metabólica Excelente';
      diagnosisMessage = `El peso promedio semanal oscila en ±${Math.abs(weeklyChangeKg)} kg (${Math.abs(weeklyChangeRatePct)}%), ideal para consolidar masa magra.`;
    } else if (weeklyChangeRatePct > 0.45) {
      status = 'needs_adjustment';
      suggestedAction = 'decrease_cals';
      suggestedDeltaKcal = -80;
      headline = 'Deriva Ascendente de Peso';
      diagnosisMessage = `El peso promedio ha subido +${weeklyChangeKg} kg en las últimas dos semanas.`;
      recommendationPrompt = `Ajustar levemente -80 kcal (a ${goal.calorie_target - 80} kcal) para restaurar el equilibrio. ¿Deseas aplicar?`;
    } else if (weeklyChangeRatePct < -0.45) {
      status = 'needs_adjustment';
      suggestedAction = 'increase_cals';
      suggestedDeltaKcal = +80;
      headline = 'Deriva Descendente de Peso';
      diagnosisMessage = `El peso promedio ha caído ${weeklyChangeKg} kg en las últimas dos semanas.`;
      recommendationPrompt = `Añadir +80 kcal (a ${goal.calorie_target + 80} kcal) para estabilizar el mantenimiento. ¿Deseas aplicar?`;
    }
  }

  return {
    daysInPhase,
    recordedDaysCount,
    adherencePct,
    avgDailyCalories,
    initialWeight,
    currentRollingAvgWeight: Number(currentRollingAvgWeight.toFixed(1)),
    previousRollingAvgWeight: Number(previousRollingAvgWeight.toFixed(1)),
    weeklyChangeRatePct,
    weeklyChangeKg,
    status,
    suggestedAction,
    suggestedDeltaKcal,
    headline,
    diagnosisMessage,
    recommendationPrompt,
  };
}
