import { NextResponse } from 'next/server';
import { getDb } from '@/lib/store/mockDb';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionUserId = cookieStore.get('duocal_session')?.value;

    if (!sessionUserId) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const db = await getDb();
    const user = db.profiles.find((p) => p.id === sessionUserId);

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const { pin_hash: _, ...safeUser } = user;
    const household = db.households.find((h) => h.id === user.household_id);

    // Pareja en el mismo hogar (si existe)
    const partner = db.profiles.find(
      (p) => p.household_id === user.household_id && p.id !== user.id
    );

    const safePartner = partner
      ? {
          id: partner.id,
          username: partner.username,
          display_name: partner.display_name,
          current_weight_kg: partner.current_weight_kg,
          share_photos_with_partner: partner.share_photos_with_partner,
        }
      : null;

    const activeGoal = db.goals.find((g) => g.user_id === user.id && g.is_active);
    const partnerGoal = partner ? db.goals.find((g) => g.user_id === partner.id && g.is_active) : null;

    return NextResponse.json({
      authenticated: true,
      user: safeUser,
      household,
      partner: safePartner,
      goal: activeGoal,
      partnerGoal: partnerGoal || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener sesión';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
