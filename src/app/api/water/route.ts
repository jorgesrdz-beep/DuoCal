import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLocalDateString } from '@/lib/utils';
import { getWaterIntake, setWaterIntake } from '@/lib/store/waterStore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getLocalDateString();

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const water_ml = getWaterIntake(userId, date);
    return NextResponse.json({ date, water_ml });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener consumo de agua';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const date = body.date || getLocalDateString();
    let amount = Number(body.water_ml);

    if (body.delta !== undefined) {
      const current = getWaterIntake(userId, date);
      amount = current + Number(body.delta);
    }

    if (isNaN(amount)) {
      return NextResponse.json({ error: 'Cantidad de agua no válida' }, { status: 400 });
    }

    const saved = setWaterIntake(userId, date, amount);
    return NextResponse.json({ success: true, date, water_ml: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar agua';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
