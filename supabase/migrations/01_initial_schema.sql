-- ==============================================================================
-- DuoCal - Esquema Completo y Datos Iniciales para Supabase
-- ==============================================================================

-- 1. Tablas Base en Orden de Dependencia

-- 1.1 Hogares
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Hogar Alex & Sam',
    invite_code VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Perfiles de Usuario
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    username TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    age INT CHECK (age > 0 AND age < 125),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    height_cm NUMERIC(5, 2) CHECK (height_cm > 50 AND height_cm < 260),
    current_weight_kg NUMERIC(5, 2) CHECK (current_weight_kg > 25 AND current_weight_kg < 350),
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very_active', 'extra_active')),
    share_photos_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    session_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Metas Periodizables
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('definition', 'recomposition', 'maintenance', 'bulking')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    suggested_duration_weeks INT NOT NULL DEFAULT 12,
    tdee_calculated INT NOT NULL,
    calorie_target INT NOT NULL,
    deficit_surplus_pct NUMERIC(4, 2) NOT NULL,
    protein_target_g NUMERIC(5, 1) NOT NULL,
    carbs_target_g NUMERIC(5, 1) NOT NULL,
    fat_target_g NUMERIC(5, 1) NOT NULL,
    fiber_target_g NUMERIC(5, 1) NOT NULL DEFAULT 30,
    water_target_ml INT NOT NULL DEFAULT 2500,
    initial_weight_kg NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 Catálogo de Alimentos
CREATE TABLE IF NOT EXISTS foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    serving_size_g NUMERIC(6, 2) NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    calories INT NOT NULL,
    protein_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    carbs_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    fat_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    source TEXT NOT NULL CHECK (source IN ('manual', 'openfoodfacts', 'usda', 'ai_label')),
    barcode TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 Platillos y Recetas
CREATE TABLE IF NOT EXISTS dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('breakfast', 'lunch', 'dinner', 'snack', 'general')),
    total_servings NUMERIC(4, 1) NOT NULL DEFAULT 1,
    total_weight_g NUMERIC(7, 2),
    serving_name TEXT NOT NULL DEFAULT 'porción',
    is_shared_with_partner BOOLEAN NOT NULL DEFAULT TRUE,
    total_calories INT NOT NULL DEFAULT 0,
    total_protein_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_carbs_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_fat_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_fiber_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    calories_per_serving INT NOT NULL DEFAULT 0,
    protein_per_serving NUMERIC(5, 2) NOT NULL DEFAULT 0,
    carbs_per_serving NUMERIC(5, 2) NOT NULL DEFAULT 0,
    fat_per_serving NUMERIC(5, 2) NOT NULL DEFAULT 0,
    fiber_per_serving NUMERIC(5, 2) NOT NULL DEFAULT 0,
    prep_time_minutes INT DEFAULT 0,
    cook_time_minutes INT DEFAULT 0,
    instructions TEXT[] DEFAULT '{}',
    is_starter_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 Ingredientes de Platillos
CREATE TABLE IF NOT EXISTS dish_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
    ingredient_name TEXT NOT NULL,
    amount_g NUMERIC(6, 2) NOT NULL,
    calories INT NOT NULL DEFAULT 0,
    protein_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    carbs_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    fat_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    fiber_g NUMERIC(5, 2) DEFAULT 0,
    sodium_mg NUMERIC(6, 2) DEFAULT 0,
    aisle_category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Planeación Semanal (Meal Plans)
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
    custom_name TEXT NOT NULL,
    servings NUMERIC(5, 2) NOT NULL DEFAULT 1,
    calories INT NOT NULL,
    protein_g NUMERIC(5, 2) NOT NULL,
    carbs_g NUMERIC(5, 2) NOT NULL,
    fat_g NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.8 Registro Diario de Alimentos (Food Logs)
CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
    food_name TEXT NOT NULL,
    amount_g NUMERIC(6, 2) NOT NULL DEFAULT 100,
    calories INT NOT NULL,
    protein_g NUMERIC(5, 2) NOT NULL,
    carbs_g NUMERIC(5, 2) NOT NULL,
    fat_g NUMERIC(5, 2) NOT NULL,
    fiber_g NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.9 Fotos de Progreso
CREATE TABLE IF NOT EXISTS body_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    storage_path TEXT NOT NULL,
    pose TEXT CHECK (pose IN ('front', 'side', 'back', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.10 Medidas Corporales
CREATE TABLE IF NOT EXISTS body_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg NUMERIC(5, 2),
    waist_cm NUMERIC(5, 2),
    arm_cm NUMERIC(5, 2),
    thigh_cm NUMERIC(5, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.11 Métricas de Salud (Apple Watch)
CREATE TABLE IF NOT EXISTS health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    active_calories_burned NUMERIC(6, 2) NOT NULL DEFAULT 0,
    steps INT NOT NULL DEFAULT 0,
    resting_heart_rate INT,
    weight_kg NUMERIC(5, 2),
    source TEXT NOT NULL DEFAULT 'apple_shortcuts',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_metric_date UNIQUE(user_id, date)
);

-- 1.12 Lista de Compras del Hogar
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    item_name TEXT NOT NULL,
    quantity_text TEXT NOT NULL,
    category TEXT DEFAULT 'Abarrotes y Granos',
    is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.13 Comparaciones de Fotos
CREATE TABLE IF NOT EXISTS photo_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    photo_before_id UUID REFERENCES body_photos(id) ON DELETE CASCADE,
    photo_after_id UUID REFERENCES body_photos(id) ON DELETE CASCADE,
    ai_description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.14 Programación de Consumo (Frecuencia)
CREATE TABLE IF NOT EXISTS consumption_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
    food_id UUID REFERENCES foods(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekdays', 'specific_days', 'meal_prep_batch')),
    days_of_week INT[] DEFAULT '{1,2,3,4,5}',
    batch_total_servings INT,
    batch_servings_remaining INT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_week ON meal_plans(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_body_photos_user_date ON body_photos(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shopping_household_week ON shopping_list_items(household_id, week_start_date);

-- 3. Funciones de Ayuda para RLS
CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS UUID AS 
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
 LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_auth_household_id()
RETURNS UUID AS 
  SELECT household_id FROM profiles WHERE id = get_auth_user_id();
 LANGUAGE sql STABLE;

-- 4. Habilitar RLS en Todas las Tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_schedules ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
DROP POLICY IF EXISTS "Service role bypass RLS profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Partners can read partner summary profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (id = get_auth_user_id() OR auth.role() = 'service_role');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = get_auth_user_id() OR auth.role() = 'service_role');
CREATE POLICY "Partners can read partner summary profile" ON profiles FOR SELECT USING (household_id IS NOT NULL AND household_id = get_auth_household_id());

DROP POLICY IF EXISTS "Members can read household" ON households;
CREATE POLICY "Members can read household" ON households FOR ALL USING (id = get_auth_household_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own goals" ON goals;
CREATE POLICY "Users manage own goals" ON goals FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can read global and own foods" ON foods;
DROP POLICY IF EXISTS "Users can insert own foods" ON foods;
CREATE POLICY "Users can read global and own foods" ON foods FOR SELECT USING (user_id IS NULL OR user_id = get_auth_user_id() OR auth.role() = 'service_role');
CREATE POLICY "Users can insert own foods" ON foods FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own dishes" ON dishes;
DROP POLICY IF EXISTS "Partner read shared dishes" ON dishes;
CREATE POLICY "Users manage own dishes" ON dishes FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');
CREATE POLICY "Partner read shared dishes" ON dishes FOR SELECT USING (is_shared_with_partner = TRUE AND household_id = get_auth_household_id());

DROP POLICY IF EXISTS "Users access ingredients of own or shared dishes" ON dish_ingredients;
CREATE POLICY "Users access ingredients of own or shared dishes" ON dish_ingredients FOR ALL USING (
    auth.role() = 'service_role' OR EXISTS (
      SELECT 1 FROM dishes d
      WHERE d.id = dish_ingredients.dish_id
        AND (d.user_id = get_auth_user_id() OR (d.is_shared_with_partner = TRUE AND d.household_id = get_auth_household_id()))
    )
);

DROP POLICY IF EXISTS "Users manage own meal plans" ON meal_plans;
CREATE POLICY "Users manage own meal plans" ON meal_plans FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own food logs" ON food_logs;
CREATE POLICY "Users manage own food logs" ON food_logs FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own measurements" ON body_measurements;
CREATE POLICY "Users manage own measurements" ON body_measurements FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own health metrics" ON health_metrics;
CREATE POLICY "Users manage own health metrics" ON health_metrics FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own photos" ON body_photos;
CREATE POLICY "Users manage own photos" ON body_photos FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Household members manage shopping list" ON shopping_list_items;
CREATE POLICY "Household members manage shopping list" ON shopping_list_items FOR ALL USING (household_id = get_auth_household_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own photo comparisons" ON photo_comparisons;
CREATE POLICY "Users manage own photo comparisons" ON photo_comparisons FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users manage own schedules" ON consumption_schedules;
CREATE POLICY "Users manage own schedules" ON consumption_schedules FOR ALL USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');

-- 6. DATOS SEMILLA INICIALES (HOGAR, USUARIOS, METAS Y RECETAS)

-- 6.1 Hogar
INSERT INTO households (id, name, invite_code)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Hogar Alex & Sam', 'DUO-2026')
ON CONFLICT (invite_code) DO NOTHING;

-- 6.2 Usuarios (Alex PIN: 123456, Sam PIN: 654321)
INSERT INTO profiles (
    id, household_id, username, pin_hash, display_name, age, gender, height_cm, current_weight_kg, activity_level, share_photos_with_partner, webhook_token
)
VALUES 
(
    'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'alex',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    'Alex', 29, 'male', 178, 78.5, 'moderate', TRUE, 'token-alex-apple-watch-secret-key-12345'
),
(
    'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000001', 'sam',
    'e7cf3cd4427d716499e90098f9864700d6efde98fe8ec936d6540db4237f35a0',
    'Sam', 27, 'female', 165, 62.0, 'light', TRUE, 'token-sam-apple-watch-secret-key-67890'
)
ON CONFLICT (username) DO NOTHING;

-- 6.3 Metas Periodizables
INSERT INTO goals (
    id, user_id, goal_type, start_date, suggested_duration_weeks, tdee_calculated, calorie_target, deficit_surplus_pct, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, water_target_ml, initial_weight_kg, is_active, notes
)
VALUES
(
    'a0000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000101', 'definition', CURRENT_DATE, 12, 2600, 2080, -0.20, 172.7, 182.0, 57.8, 29.1, 2748, 78.5, TRUE, 'Fase de definición moderada (-20%) con alto aporte de proteína'
),
(
    'a0000000-0000-0000-0000-000000000302', 'a0000000-0000-0000-0000-000000000202', 'recomposition', CURRENT_DATE, 16, 1950, 1755, -0.10, 124.0, 184.3, 58.5, 25.0, 2170, 62.0, TRUE, 'Recomposición corporal (-10% déficit ligero)'
)
ON CONFLICT (id) DO NOTHING;

-- 6.4 Alimentos Base Frecuentes
INSERT INTO foods (id, user_id, name, brand, serving_size_g, serving_unit, calories, protein_g, carbs_g, fat_g, source, is_verified)
VALUES
('a0000000-0000-0000-0000-000000000401', NULL, 'Pechuga de Pollo cocida', 'Genérico', 100, 'g', 165, 31.0, 0.0, 3.6, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000402', NULL, 'Arroz blanco cocido', 'Genérico', 100, 'g', 130, 2.7, 28.2, 0.3, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000403', NULL, 'Avena en hojuelas', 'Quaker', 40, 'g', 150, 5.0, 27.0, 2.5, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000404', NULL, 'Huevo entero cocido', 'San Juan', 50, 'pieza', 72, 6.3, 0.4, 4.8, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000405', NULL, 'Yogurt Griego Fage 0%', 'Fage', 150, 'g', 80, 15.0, 5.0, 0.0, 'openfoodfacts', TRUE),
('a0000000-0000-0000-0000-000000000406', NULL, 'Aguacate Hass', 'Genérico', 50, 'g', 80, 1.0, 4.0, 7.3, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000407', NULL, 'Proteína Whey Isolate', 'Optimum Nutrition', 30, 'scoop', 120, 24.0, 2.0, 1.0, 'manual', TRUE),
('a0000000-0000-0000-0000-000000000408', NULL, 'Espinaca fresca', 'Genérico', 100, 'g', 23, 2.9, 3.6, 0.4, 'manual', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 6.5 Platillos Demo Iniciales
INSERT INTO dishes (
    id, user_id, household_id, name, description, category, total_servings, total_weight_g, serving_name, is_shared_with_partner,
    total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
    calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving,
    prep_time_minutes, cook_time_minutes, is_starter_template
)
VALUES
(
    'a0000000-0000-0000-0000-000000000501', 'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001',
    'Bowl de Pollo, Arroz y Aguacate (Meal Prep)', 'Guisado de pechuga con especias y arroz al vapor, dividido en 4 porciones iguales.',
    'lunch', 4, 1200, 'recipiente (300g)', TRUE,
    1840, 196, 140, 44, 16,
    460, 49, 35, 11, 4,
    15, 25, FALSE
),
(
    'a0000000-0000-0000-0000-000000000502', 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000001',
    'Overnight Oats con Proteína y Berries', 'Avena reposada en yogurt griego con proteína y frutos rojos.',
    'breakfast', 2, 500, 'frasco (250g)', TRUE,
    680, 58, 74, 12, 10,
    340, 29, 37, 6, 5,
    10, 0, FALSE
)
ON CONFLICT (id) DO NOTHING;
