import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { z } from 'zod';
import crypto from 'crypto';

const HealthPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  active_calories_burned: z.number().nonnegative({ message: 'Las calorías activas deben ser positivas' }),
  steps: z.number().int().nonnegative({ message: 'Los pasos deben ser un número entero positivo' }),
  resting_heart_rate: z.number().int().positive().optional(),
  weight_kg: z.number().positive().optional(),
});

// Simple in-memory rate limiter: token -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Token de webhook inválido o ausente' }, { status: 401 });
    }

    // 1. Rate Limiting: Máximo 30 peticiones por hora por token
    const now = Date.now();
    const rateRecord = rateLimitMap.get(token) || { count: 0, resetAt: now + 3600000 };
    if (now > rateRecord.resetAt) {
      rateRecord.count = 0;
      rateRecord.resetAt = now + 3600000;
    }
    rateRecord.count += 1;
    rateLimitMap.set(token, rateRecord);

    if (rateRecord.count > 30) {
      return NextResponse.json(
        { error: 'Límite de solicitudes del webhook excedido. Máximo 30 peticiones por hora.' },
        { status: 429 }
      );
    }

    // 2. Buscar usuario por su webhook_token único
    const db = await getDb();
    const user = db.profiles.find((p) => p.webhook_token === token);

    if (!user) {
      return NextResponse.json({ error: 'Token no coincide con ningún usuario activo' }, { status: 404 });
    }

    // 3. Validar payload JSON
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload debe ser un JSON válido' }, { status: 400 });
    }

    const parseResult = HealthPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Formato de datos no válido', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { date = new Date().toISOString().split('T')[0], active_calories_burned, steps, resting_heart_rate, weight_kg } = parseResult.data;

    // 4. Upsert en health_metrics
    const existingIndex = db.health_metrics.findIndex(
      (m) => m.user_id === user.id && m.date === date
    );

    const metricData = {
      id: existingIndex !== -1 ? db.health_metrics[existingIndex].id : 'hm-' + crypto.randomUUID().slice(0, 8),
      user_id: user.id,
      date,
      active_calories_burned: Math.round(active_calories_burned * 10) / 10,
      steps: Math.round(steps),
      resting_heart_rate: resting_heart_rate || null,
      weight_kg: weight_kg || null,
      source: 'apple_shortcuts',
      created_at: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      db.health_metrics[existingIndex] = metricData;
    } else {
      db.health_metrics.push(metricData);
    }

    // 5. Si se reportó peso, actualizar peso actual del usuario
    if (weight_kg && weight_kg > 0) {
      user.current_weight_kg = Number(weight_kg.toFixed(2));
    }

    return NextResponse.json({
      success: true,
      message: 'Métricas de salud recibidas e indexadas correctamente',
      data: metricData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en webhook';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
