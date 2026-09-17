-- ==============================================================================
-- DuoCal - Datos Semilla Iniciales (Seed Data)
-- ==============================================================================

-- 1. Hogar Demo Compartido
INSERT INTO households (id, name, invite_code)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Hogar Alex & Sam', 'DUO-2026')
ON CONFLICT (invite_code) DO NOTHING;

-- 2. Perfiles Demo (Alex y Sam) con PIN Hasheado (bcrypt/SHA-256)
-- PIN Alex: 123456
-- PIN Sam: 654321
INSERT INTO profiles (
    id, household_id, username, pin_hash, display_name, age, gender, height_cm, current_weight_kg, activity_level, share_photos_with_partner, webhook_token
)
VALUES 
(
    'a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', 'alex',
    -- Hash SHA-256 de PIN '123456'
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    'Alex', 29, 'male', 178, 78.5, 'moderate', TRUE, 'token-alex-apple-watch-secret-key-12345'
),
(
    'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000001', 'sam',
    -- Hash SHA-256 de PIN '654321'
    'e7cf3cd4427d716499e90098f9864700d6efde98fe8ec936d6540db4237f35a0',
    'Sam', 27, 'female', 165, 62.0, 'light', TRUE, 'token-sam-apple-watch-secret-key-67890'
)
ON CONFLICT (username) DO NOTHING;

-- 3. Metas Periodizables Iniciales
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

-- 4. Alimentos Base Frecuentes
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

-- 5. Platillos Demo Iniciales
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
