-- Migración para agregar la columna fiber_g a la tabla foods
ALTER TABLE foods ADD COLUMN IF NOT EXISTS fiber_g NUMERIC(5, 2) DEFAULT 0;
