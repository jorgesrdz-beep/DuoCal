# DuoCal - Calorie & Macro Tracking en Pareja

Aplicación web mobile-first diseñada para parejas que llevan el control y planeación de su alimentación, enfocada en el **balance semanal acumulado** (días fijos entre semana y fin de semana flexible), privacidad granular, fotos corporales con siluetas guía y sincronización con Apple Watch.

---

## Características Implementadas

1. **Autenticación por Usuario + PIN:**
   - Acceso con PIN de 6+ dígitos (teclado numérico táctil optimizado para móviles).
   - Rate limiting con bloqueo progresivo (5 min, 15 min, 60 min tras intentos fallidos).
   - Acceso rápido de prueba para la pareja demo:
     - **Alex:** PIN `123456`
     - **Sam:** PIN `654321`
2. **Metas Nutricionales Periodizables (Fase 2):**
   - Calculadora de TDEE (Mifflin-St Jeor) según peso, altura, edad, sexo y nivel de actividad.
   - 4 fases periodizables: **Definición** (-20%), **Recomposición** (-5%), **Mantenimiento** (0%), **Volumen** (+8%).
   - Recalcula macros automáticamente al actualizar el peso actual.
   - Monitor de ritmo saludable (0.3% – 0.7% del peso corporal/semana).
3. **Catálogo de Alimentos y Registro Diario (Fase 3):**
   - Búsqueda en vivo en **Open Food Facts API** (productos de supermercado con código de barras o texto).
   - Alimentos personalizados guardados en el catálogo propio.
   - Registro de comidas diarias por tiempos (Desayuno, Comida, Cena, Snacks).
4. **Planeación Semanal y Lista de Compras (Fase 4):**
   - Calendario semanal interactivo (Lunes a Domingo).
   - **Botón "Duplicar día a entre semana":** clona las comidas del lunes a martes-viernes/sábado en 1 solo paso.
   - Lista de compras unificada del hogar con botón **"Autogenerar desde el plan"**.
5. **Reconocimiento de Tablas Nutrimentales con IA (Fase 5):**
   - Subida de foto de etiquetas nutrimentales.
   - Extracción estructurada de calorías, proteínas, carbohidratos y grasas con Google Gemini Vision.
   - Pantalla de revisión y ajuste manual antes de registrar.
6. **Reportes y Balance Semanal Acumulado (Fase 6):**
   - Indicador principal: promedio de 7 días vs. meta semanal (no penaliza comidas libres de fin de semana).
   - Gráficas de tendencias con Recharts anotando la meta activa.
   - Resumen compartido de pareja: visualización general del progreso del otro sin revelar los alimentos específicos diarios.
7. **Fotos Corporales y Siluetas Guía (Fase 7 y 8):**
   - Guía visual semitransparente superpuesta (silueta anatómica) para estandarizar ángulo y distancia entre tomas.
   - Comparador de fotos lado a lado por fecha.
   - **Análisis Descriptivo con IA (Opt-in):** descripción cualitativa y motivacional de cambios visuales sin medición biométrica ni % de grasa invasivo.
   - Permiso toggle de privacidad: "Compartir fotos con mi pareja" o "Solo visible por mí".
8. **Integración con Apple Watch vía Atajos (Fase 9):**
   - Endpoint propio seguro: `POST /api/health-webhook/[token]`.
   - Captura de calorías activas quemadas, pasos y peso registrado.
   - Botón interactivo para simular sincronización en tiempo real.
9. **Exportación y Borrado de Datos (Fase 10):**
   - Exportación completa en formato **JSON** o **CSV**.
   - Eliminación total de cuenta y borrado en cascada (derecho al olvido).

---

## Ejecución en Local

1. Entra a la carpeta del proyecto:
   ```bash
   cd C:\Users\pc\.gemini\antigravity\scratch\duo-calories
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## Configuración de Supabase (Producción / Base de Datos Remota)

El proyecto incluye el script completo de base de datos con políticas de seguridad RLS en:
`supabase/migrations/01_initial_schema.sql`

Para conectarlo con tu cuenta de Supabase:
1. Copia y pega el contenido de `supabase/migrations/01_initial_schema.sql` en el **SQL Editor** del dashboard de Supabase y presiona **Run**.
2. En tu archivo `.env.local`, coloca tus credenciales:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   GEMINI_API_KEY=tu-gemini-api-key
   ```

---

## Configuración del Atajo de Apple Shortcuts (iPhone / Apple Watch)

1. Abre la app **Atajos** en tu iPhone y crea un nuevo atajo.
2. Agrega la acción **Buscar muestras de Salud**:
   - Tipo de muestra: *Calorías activas*, *Pasos*, *Peso*.
   - Rango: *Hoy*.
3. Agrega la acción **Diccionario**:
   - Clave `date`: Formato de fecha `YYYY-MM-DD`.
   - Clave `active_calories_burned`: Número de calorías activas sumadas.
   - Clave `steps`: Número de pasos.
   - Clave `weight_kg`: Peso en kg (opcional).
4. Agrega la acción **Obtener contenido de URL**:
   - URL: `https://tudominio.vercel.app/api/health-webhook/[TU_TOKEN]`
   - Método: `POST`
   - Encabezados: `Content-Type: application/json`
   - Cuerpo de la petición: Selecciona el `Diccionario`.
5. En la pestaña **Automatización**, configura que se ejecute a las 23:30 todos los días sin preguntar.
