import bcrypt from 'bcryptjs';

export function validatePinFormat(pin: string): { valid: boolean; message?: string } {
  if (!/^\d{6,}$/.test(pin)) {
    return {
      valid: false,
      message: 'El PIN debe contener al menos 6 dígitos numéricos.',
    };
  }
  return { valid: true };
}

export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

export function calculateLockoutDurationMinutes(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 5;
  if (failedAttempts === 6) return 15;
  return 60; // 7 o más intentos: 1 hora
}

export function isAccountLocked(lockedUntil: string | null): { locked: boolean; remainingSeconds: number } {
  if (!lockedUntil) return { locked: false, remainingSeconds: 0 };
  const lockTime = new Date(lockedUntil).getTime();
  const now = Date.now();
  if (lockTime > now) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((lockTime - now) / 1000),
    };
  }
  return { locked: false, remainingSeconds: 0 };
}
