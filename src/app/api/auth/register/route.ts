import { NextResponse } from 'next/server';
import { getDb, insertRow } from '@/lib/store/mockDb';
import { hashPin, validatePinFormat } from '@/lib/auth/pin';
import { calculateGoalMacros } from '@/lib/tdee';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { GoalType } from '@/types/database';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      username,
      pin,
      displayName,
      age,
      gender,
      height_cm,
      current_weight_kg,
      activity_level,
      goal_type = 'maintenance' as GoalType,
      invite_code,
    } = body;

    if (!username || !pin || !displayName || !height_cm || !current_weight_kg) {
      return NextResponse.json(
        { error: 'Por favor completa todos los campos requeridos.' },
        { status: 400 }
      );
    }

    const pinValidation = validatePinFormat(pin);
    if (!pinValidation.valid) {
      return NextResponse.json({ error: pinValidation.message }, { status: 400 });
    }

    const db = await getDb();
    const cleanUsername = username.trim().toLowerCase();

    if (db.profiles.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return NextResponse.json(
        { error: 'Ese nombre de usuario ya está registrado. Elige otro.' },
        { status: 400 }
      );
    }

    // Determinar o crear Household
    let householdId = null;
    let householdName = 'Hogar de ' + displayName;

    if (invite_code && invite_code.trim()) {
      const cleanCode = invite_code.trim().toUpperCase();
      const existingHousehold = db.households.find((h) => h.invite_code === cleanCode);
      if (!existingHousehold) {
        return NextResponse.json(
          { error: 'El código de invitación para unirte al hogar no es válido.' },
          { status: 400 }
        );
      }
      householdId = existingHousehold.id;
    } else {
      const newHouseholdId = crypto.randomUUID();
      const newInviteCode = 'DUO-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const newHousehold = {
        id: newHouseholdId,
        name: householdName,
        invite_code: newInviteCode,
        created_at: new Date().toISOString(),
      };
      await insertRow('households', newHousehold);
      householdId = newHouseholdId;
    }

    const pin_hash = await hashPin(pin);
    const userId = crypto.randomUUID();
    const webhookToken = 'tok_' + crypto.randomBytes(16).toString('hex');

    const newProfile = {
      id: userId,
      household_id: householdId,
      username: cleanUsername,
      pin_hash,
      display_name: displayName.trim(),
      age: Number(age) || 25,
      gender: gender || 'male',
      height_cm: Number(height_cm),
      current_weight_kg: Number(current_weight_kg),
      activity_level: activity_level || 'moderate',
      share_photos_with_partner: true,
      webhook_token: webhookToken,
      failed_login_attempts: 0,
      locked_until: null,
      session_token: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await insertRow('profiles', newProfile);

    // Calcular meta inicial
    const macros = calculateGoalMacros(
      {
        age: newProfile.age,
        gender: newProfile.gender,
        height_cm: newProfile.height_cm,
        weight_kg: newProfile.current_weight_kg,
        activity_level: newProfile.activity_level,
      },
      goal_type
    );

    const newGoal = {
      id: crypto.randomUUID(),
      user_id: userId,
      goal_type,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      suggested_duration_weeks: macros.suggested_duration_weeks,
      tdee_calculated: macros.tdee,
      calorie_target: macros.calorie_target,
      deficit_surplus_pct: macros.deficit_surplus_pct,
      protein_target_g: macros.protein_target_g,
      carbs_target_g: macros.carbs_target_g,
      fat_target_g: macros.fat_target_g,
      fiber_target_g: 30,
      water_target_ml: 2500,
      initial_weight_kg: newProfile.current_weight_kg,
      is_active: true,
      notes: 'Meta inicial configurada al registrarse',
      created_at: new Date().toISOString(),
    };

    await insertRow('goals', newGoal);

    // Establecer sesión
    const cookieStore = await cookies();
    cookieStore.set('duocal_session', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    const { pin_hash: _, ...safeUser } = newProfile;
    const household = db.households.find((h) => h.id === householdId);

    return NextResponse.json({
      success: true,
      user: safeUser,
      household,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
