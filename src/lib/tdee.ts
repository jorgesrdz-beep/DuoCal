import { ActivityLevel, Gender, GoalType } from '@/types/database';

export interface TDEEInput {
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
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
  water_target_ml: number;
  min_safe_floor: number;
  is_floor_clamped: boolean;
  protein_ratio_g_per_kg: number;
  fat_ratio_g_per_kg: number;
  suggested_duration_weeks: number;
  reEvaluationCriteria: string;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // Poco o nada de ejercicio
  light: 1.375,         // Ejercicio ligero 1-3 días/sem
  moderate: 1.55,       // Ejercicio moderado 3-5 días/sem
  very_active: 1.725,   // Ejercicio fuerte 6-7 días/sem
  extra_active: 1.9,    // Ejercicio muy fuerte o trabajo físico intenso
};

/**
 * Calcula el BMR usando la ecuación de Mifflin-St Jeor
 */
export function calculateBMR(gender: Gender, weight_kg: number, height_cm: number, age: number): number {
  if (gender === 'female') {
    return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161);
  }
  // Por defecto cálculo masculino/otro
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5);
}

/**
 * Calcula el TDEE (Gasto Energético Diario Total)
 */
export function calculateTDEE(input: TDEEInput): number {
  const bmr = calculateBMR(input.gender, input.weight_kg, input.height_cm, input.age);
  const factor = ACTIVITY_MULTIPLIERS[input.activity_level] || 1.2;
  return Math.round(bmr * factor);
}

/**
 * Calcula los objetivos según el tipo de meta seleccionada:
 * - Definición: -15% a -20%, 1.8-2.2 g/kg proteína, 8-12 semanas
 * - Recomposición: -5% a 0%, 1.8-2.0 g/kg proteína, 3-6 meses (16 sem)
 * - Mantenimiento: 0%, 1.6-1.8 g/kg proteína, sin límite fijo (12 sem)
 * - Volumen: +5% a +10%, 1.6-2.0 g/kg proteína, 3-6 meses (16 sem)
 * Grasa mínima: 0.7 g/kg. El resto se completa en Carbohidratos.
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
  let fat_ratio = 0.8;
  let suggested_duration_weeks = 12;
  let criteria = '';

  switch (goal_type) {
    case 'definition':
      deficit_surplus_pct = customDeficitPct !== undefined ? customDeficitPct : -0.20; // -20%
      protein_ratio = 2.0; // 1.8 - 2.2 g/kg
      fat_ratio = 0.75;
      suggested_duration_weeks = 12;
      criteria = 'Llegar al % de grasa deseado o registrar caída notoria de fuerza en entrenamientos.';
      break;

    case 'recomposition':
      deficit_surplus_pct = customDeficitPct !== undefined ? customDeficitPct : -0.05; // -5%
      protein_ratio = 1.9; // 1.8 - 2.0 g/kg
      fat_ratio = 0.8;
      suggested_duration_weeks = 16;
      criteria = 'Si tras 8-10 semanas no hay cambio visible en cintura o fotos, considerar pasar a Definición.';
      break;

    case 'maintenance':
      deficit_surplus_pct = 0.0;
      protein_ratio = 1.7; // 1.6 - 1.8 g/kg
      fat_ratio = 0.85;
      suggested_duration_weeks = 12;
      criteria = 'Monitorear estabilidad de peso corporal semanal.';
      break;

    case 'bulking':
      deficit_surplus_pct = customDeficitPct !== undefined ? customDeficitPct : 0.08; // +8%
      protein_ratio = 1.8; // 1.6 - 2.0 g/kg
      fat_ratio = 0.9;
      suggested_duration_weeks = 16;
      criteria = 'Si la ganancia de cintura supera proporcionalmente la ganancia de fuerza y peso, reevaluar.';
      break;
  }

  // Piso Calórico Clínico de Seguridad (OMS/ISSN):
  // Ningún plan debe reducir calorías por debajo de 1,200 kcal (mujeres) o 1,500 kcal (hombres)
  const min_safe_floor = input.gender === 'female' ? 1200 : 1500;
  const raw_calorie_target = Math.round(tdee * (1 + deficit_surplus_pct));
  const is_floor_clamped = raw_calorie_target < min_safe_floor;
  const calorie_target = Math.max(min_safe_floor, raw_calorie_target);

  // Proteína: 4 kcal por gramo
  const protein_target_g = Math.round(input.weight_kg * protein_ratio);
  const protein_cals = protein_target_g * 4;

  // Grasa: 9 kcal por gramo (mínimo fisiológico para síntesis esteroidea)
  const fat_target_g = Math.round(input.weight_kg * fat_ratio);
  const fat_cals = fat_target_g * 9;

  // Carbohidratos: 4 kcal por gramo (resto de calorías)
  const remaining_cals = Math.max(0, calorie_target - protein_cals - fat_cals);
  const carbs_target_g = Math.round(remaining_cals / 4);

  // Meta Diaria de Fibra Dietética (Estándar OMS / AHA: 14g por cada 1,000 kcal o mín 25g/30g)
  const fiber_target_g = input.gender === 'female'
    ? Math.max(25, Math.round((calorie_target / 1000) * 14))
    : Math.max(30, Math.round((calorie_target / 1000) * 14));

  // Ingesta Hídrica Diaria Recomendada (Consenso clínico: 35 ml por kg de peso corporal)
  const water_target_ml = Math.round(input.weight_kg * 35);

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
    water_target_ml,
    min_safe_floor,
    is_floor_clamped,
    protein_ratio_g_per_kg: protein_ratio,
    fat_ratio_g_per_kg: fat_ratio,
    suggested_duration_weeks,
    reEvaluationCriteria: criteria,
  };
}
