'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, Users, Sparkles, AlertCircle, ArrowRight, Delete, Heart } from 'lucide-react';
import { ActivityLevel, Gender, GoalType } from '@/types/database';

export default function AuthModal() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Estados de Login
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de Registro
  const [regMode, setRegMode] = useState<'individual' | 'shared'>('individual');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regAge, setRegAge] = useState('28');
  const [regGender, setRegGender] = useState<Gender>('male');
  const [regHeight, setRegHeight] = useState('175');
  const [regWeight, setRegWeight] = useState('75');
  const [regActivity, setRegActivity] = useState<ActivityLevel>('moderate');
  const [regGoal, setRegGoal] = useState<GoalType>('definition');
  const [regInviteCode, setRegInviteCode] = useState('');

  const handleKeypadPress = (val: string) => {
    if (pin.length < 6) {
      const nextPin = pin + val;
      setPin(nextPin);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username || pin.length < 6) {
      setError('Por favor introduce tu usuario y el PIN completo de 6 dígitos.');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await login(username, pin);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Error al iniciar sesión');
      setPin('');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || regPin.length < 6 || !regDisplayName || !regHeight || !regWeight) {
      setError('Por favor completa todos los campos y un PIN de al menos 6 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await register({
      username: regUsername,
      pin: regPin,
      displayName: regDisplayName,
      age: Number(regAge),
      gender: regGender,
      height_cm: Number(regHeight),
      current_weight_kg: Number(regWeight),
      activity_level: regActivity,
      goal_type: regGoal,
      invite_code: regMode === 'shared' && regInviteCode.trim() ? regInviteCode.trim() : undefined,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Error al crear la cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden p-6 sm:p-8">
        {/* Encabezado Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 mx-auto flex items-center justify-center text-white shadow-md shadow-emerald-500/20 mb-3">
            <Users className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white">DuoCal</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Tracking y planeación nutricional inteligente
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!isRegister ? (
          /* FORMULARIO DE LOGIN CON PIN PAD */
          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Nombre de usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* PIN Dots Display */}
            <div className="mb-4 text-center">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-2">
                PIN de 6 dígitos
              </span>
              <div className="flex justify-center items-center gap-3 py-2">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const hasDigit = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        hasDigit
                          ? 'bg-emerald-500 scale-110 shadow-sm shadow-emerald-500/50'
                          : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Teclado Numérico Touch-Friendly */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-2xl text-lg font-bold text-zinc-800 dark:text-zinc-100 transition active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <div className="h-12" />
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-2xl text-lg font-bold text-zinc-800 dark:text-zinc-100 transition active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-2xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Botón de envío */}
            <button
              type="button"
              disabled={loading || pin.length < 6}
              onClick={() => handleLoginSubmit()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl text-sm transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Verificando PIN...' : 'Ingresar a DuoCal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                ¿No tienes cuenta? Regístrate aquí
              </button>
            </div>
          </div>
        ) : (
          /* FORMULARIO DE REGISTRO */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {/* Selector de Modo: Individual vs Compartido */}
            <div className="p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl grid grid-cols-2 gap-1 mb-1">
              <button
                type="button"
                onClick={() => {
                  setRegMode('individual');
                  setRegInviteCode('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  regMode === 'individual'
                    ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Uso Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setRegMode('shared')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  regMode === 'shared'
                    ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Duo / Roomie</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. carlos"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Nombre visible
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Carlos"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                PIN de acceso (mínimo 6 dígitos numéricos)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6,}"
                required
                maxLength={8}
                placeholder="••••••"
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono tracking-widest text-center"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Edad
                </label>
                <input
                  type="number"
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  value={regHeight}
                  onChange={(e) => setRegHeight(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={regWeight}
                  onChange={(e) => setRegWeight(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Sexo biológico
                </label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value as Gender)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                >
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                  Actividad física
                </label>
                <select
                  value={regActivity}
                  onChange={(e) => setRegActivity(e.target.value as ActivityLevel)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white"
                >
                  <option value="sedentary">Sedentario (oficina)</option>
                  <option value="light">Ligera (1-3 días)</option>
                  <option value="moderate">Moderada (3-5 días)</option>
                  <option value="very_active">Fuerte (6-7 días)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                Meta inicial
              </label>
              <select
                value={regGoal}
                onChange={(e) => setRegGoal(e.target.value as GoalType)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white font-medium text-emerald-600 dark:text-emerald-400"
              >
                <option value="definition">Definición (-20% TDEE, alta proteína)</option>
                <option value="recomposition">Recomposición (-5% TDEE, ganar músculo)</option>
                <option value="maintenance">Mantenimiento (0% TDEE)</option>
                <option value="bulking">Volumen (+8% TDEE)</option>
              </select>
            </div>

            {regMode === 'shared' ? (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl">
                <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 mb-1">
                  Código de invitación (Opcional)
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                  Si tu compañero ya creó su cuenta, escribe su código aquí. Si tú eres el primero, déjalo vacío para generar un nuevo código.
                </p>
                <input
                  type="text"
                  placeholder="ej. DUO-A1B2"
                  value={regInviteCode}
                  onChange={(e) => setRegInviteCode(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white uppercase font-mono tracking-wider"
                />
              </div>
            ) : (
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-xl flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <User className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Modo individual: tu historial y metas serán 100% privados.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl text-sm transition shadow-md shadow-emerald-600/20"
            >
              {loading ? 'Creando cuenta...' : 'Completar Registro'}
            </button>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="text-xs text-zinc-500 hover:underline"
              >
                ¿Ya tienes cuenta? Inicia sesión con PIN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
