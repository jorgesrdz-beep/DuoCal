export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel = 
  | 'sedentary' 
  | 'light' 
  | 'moderate' 
  | 'very_active' 
  | 'extra_active';

export type GoalType = 
  | 'definition' 
  | 'recomposition' 
  | 'maintenance' 
  | 'bulking';

export type MealType = 
  | 'breakfast' 
  | 'lunch' 
  | 'dinner' 
  | 'snack';

export type FoodSource = 
  | 'manual' 
  | 'openfoodfacts' 
  | 'usda' 
  | 'ai_label';

export type BodyPhotoPose = 
  | 'front' 
  | 'side' 
  | 'back' 
  | 'other';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  household_id: string | null;
  username: string;
  display_name: string;
  age: number | null;
  gender: Gender | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  neat_level?: 'sedentary' | 'light_standing' | 'active_walking' | 'heavy_labor' | null;
  training_sessions_per_week?: number | null;
  daily_steps_target?: number | null;
  share_photos_with_partner: boolean;
  webhook_token: string;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  goal_type: GoalType;
  start_date: string;
  end_date: string | null;
  suggested_duration_weeks: number;
  tdee_calculated: number;
  calorie_target: number;
  deficit_surplus_pct: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g?: number;
  water_target_ml?: number;
  initial_weight_kg: number;
  is_active: boolean;
  macro_preference?: 'balanced' | 'high_carb' | 'higher_fat';
  target_rate_pct_per_week?: number;
  evaluation_period_weeks?: number;
  re_evaluation_criteria?: string;
  notes: string | null;
  created_at: string;
}

export interface Food {
  id: string;
  user_id: string | null;
  name: string;
  brand: string | null;
  serving_size_g: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  source: FoodSource;
  barcode: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  user_id: string;
  week_start_date: string;
  day_of_week: number; // 1 to 7
  meal_type: MealType;
  food_id: string | null;
  custom_name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  created_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  amount_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  created_at: string;
}

export interface BodyPhoto {
  id: string;
  user_id: string;
  date: string;
  storage_path: string;
  signed_url?: string;
  pose: BodyPhotoPose;
  notes: string | null;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface HealthMetric {
  id: string;
  user_id: string;
  date: string;
  active_calories_burned: number;
  steps: number;
  resting_heart_rate: number | null;
  weight_kg: number | null;
  source: string;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  household_id: string;
  week_start_date: string;
  item_name: string;
  quantity_text: string;
  category: string;
  is_purchased: boolean;
  created_at: string;
}

export interface DishIngredient {
  id: string;
  dish_id: string;
  food_id: string | null;
  ingredient_name: string;
  amount_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sodium_mg?: number;
  aisle_category?: 'Carnicería y Proteínas' | 'Frutas y Verduras' | 'Abarrotes y Granos' | 'Lácteos y Refrigerados' | 'Condimentos y Aceites' | 'Otros';
  created_at: string;
}

export interface Dish {
  id: string;
  user_id: string | null;
  household_id: string | null;
  name: string;
  description: string | null;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'general';
  total_servings: number;
  total_weight_g: number | null;
  serving_name: string; // ej. "porción", "plato", "taza"
  is_shared_with_partner: boolean;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  instructions?: string[];
  is_starter_template?: boolean;
  ingredients?: DishIngredient[];
  // Totales acumulados calculados
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  // Por porción individual
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
  fiber_per_serving: number;
  created_at: string;
}

export interface FrequentItem {
  id: string;
  name: string;
  meal_type: MealType;
  type: 'food' | 'dish';
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  amount_g: number;
  portion_name?: string;
  dish_id?: string;
  food_id?: string;
  times_logged: number;
}

export type FrequencyType = 'daily' | 'weekdays' | 'specific_days' | 'meal_prep_batch';

export interface ConsumptionSchedule {
  id: string;
  user_id: string;
  dish_id: string | null;
  food_id: string | null;
  meal_type: MealType;
  frequency_type: FrequencyType;
  days_of_week: number[]; // 1=Lunes, 7=Domingo
  batch_total_servings?: number;
  batch_servings_remaining?: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PhotoComparison {
  id: string;
  user_id: string;
  photo_before_id: string;
  photo_after_id: string;
  ai_description: string;
  created_at: string;
}

export interface PartnerSummary {
  user_id: string;
  display_name: string;
  goal_type: GoalType;
  calorie_target: number;
  protein_target_g: number;
  avg_daily_calories: number;
  avg_daily_protein: number;
  days_logged: number;
  week_start: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  water_ml: number;
  created_at?: string;
  updated_at?: string;
}

