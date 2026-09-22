import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/store/mockDb';
import crypto from 'crypto';
import { getLocalDateString } from '@/lib/utils';

// En memoria guardamos las fotos del usuario
const photoStore: Array<{
  id: string;
  user_id: string;
  date: string;
  data_url: string;
  pose: 'front' | 'side' | 'back' | 'other';
  notes: string | null;
  created_at: string;
}> = [];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const target = searchParams.get('target') || 'me'; // 'me' o 'partner'

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = await getDb();
    const currentUser = db.profiles.find((p) => p.id === userId);

    let queryUserId = userId;

    if (target === 'partner') {
      const partner = db.profiles.find(
        (p) => p.household_id === currentUser?.household_id && p.id !== userId
      );

      if (!partner) {
        return NextResponse.json({ photos: [], partnerName: null });
      }

      if (!partner.share_photos_with_partner) {
        return NextResponse.json(
          { error: 'Tu compañero/a no ha activado el permiso para compartir fotos de progreso.' },
          { status: 403 }
        );
      }

      queryUserId = partner.id;
    }

    const photos = photoStore
      .filter((p) => p.user_id === queryUserId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ photos });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al obtener fotos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { date, data_url, pose = 'front', notes } = body;

    if (!data_url) {
      return NextResponse.json({ error: 'Foto requerida' }, { status: 400 });
    }

    const newPhoto = {
      id: 'photo-' + crypto.randomUUID().slice(0, 8),
      user_id: userId,
      date: date || getLocalDateString(),
      data_url,
      pose: pose as 'front' | 'side' | 'back' | 'other',
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    photoStore.unshift(newPhoto);

    return NextResponse.json({ success: true, photo: newPhoto });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar foto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const cookieStore = await cookies();
    const userId = cookieStore.get('duocal_session')?.value;
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const index = photoStore.findIndex((p) => p.id === id && p.user_id === userId);
    if (index !== -1) {
      photoStore.splice(index, 1);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
