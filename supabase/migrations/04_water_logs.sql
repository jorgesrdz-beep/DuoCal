-- 04_water_logs.sql
-- Tabla para registrar el consumo diario de agua por usuario
CREATE TABLE IF NOT EXISTS water_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    water_ml INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_water_date UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date);

-- Seguridad a nivel de fila (RLS)
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own water logs" ON water_logs;
CREATE POLICY "Users manage own water logs" ON water_logs 
    FOR ALL 
    USING (user_id = get_auth_user_id() OR auth.role() = 'service_role');
