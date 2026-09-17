import { NextResponse } from 'next/server';
import { getDb, updateRow } from '@/lib/store/mockDb';
import { verifyPin, isAccountLocked, calculateLockoutDurationMinutes } from '@/lib/auth/pin';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin) {
      return NextResponse.json(
        { error: 'Usuario y PIN son requeridos.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const cleanUsername = username.trim().toLowerCase();
    const user = db.profiles.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 }
      );
    }

    // 1. Verificar bloqueo por intentos previos
    const lockStatus = isAccountLocked(user.locked_until);
    if (lockStatus.locked) {
      const minutesLeft = Math.ceil(lockStatus.remainingSeconds / 60);
      return NextResponse.json(
        {
          error: `Cuenta bloqueada temporalmente por exceso de intentos. Intenta de nuevo en ${minutesLeft} minuto(s).`,
          locked: true,
          remainingSeconds: lockStatus.remainingSeconds,
        },
        { status: 429 }
      );
    }

    // 2. Verificar PIN
    const isValid = await verifyPin(pin, user.pin_hash);

    if (!isValid) {
      user.failed_login_attempts += 1;
      const lockoutMinutes = calculateLockoutDurationMinutes(user.failed_login_attempts);

      if (lockoutMinutes > 0) {
        user.locked_until = new Date(Date.now() + lockoutMinutes * 60000).toISOString();
        await updateRow('profiles', user.id, {
          failed_login_attempts: user.failed_login_attempts,
          locked_until: user.locked_until,
        });
        return NextResponse.json(
          {
            error: `PIN incorrecto. Has superado el límite de intentos. Cuenta bloqueada por ${lockoutMinutes} minutos.`,
            locked: true,
            attempts: user.failed_login_attempts,
          },
          { status: 429 }
        );
      }

      await updateRow('profiles', user.id, {
        failed_login_attempts: user.failed_login_attempts,
        locked_until: null,
      });

      const remainingAttempts = 5 - user.failed_login_attempts;
      return NextResponse.json(
        {
          error: `PIN incorrecto. Te quedan ${remainingAttempts} intento(s) antes del bloqueo temporal.`,
          attempts: user.failed_login_attempts,
        },
        { status: 401 }
      );
    }

    // 3. Éxito: Limpiar intentos fallidos
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await updateRow('profiles', user.id, {
      failed_login_attempts: 0,
      locked_until: null,
    });

    // 4. Establecer cookie de sesión segura
    const cookieStore = await cookies();
    cookieStore.set('duocal_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días de persistencia
    });

    const { pin_hash: _, ...safeUser } = user;
    const household = db.households.find((h) => h.id === user.household_id);

    return NextResponse.json({
      success: true,
      user: safeUser,
      household,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
