'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Target, Watch, Download, Trash2, Copy, Check, Sparkles, AlertTriangle, ChevronRight, Activity, Droplets, ShieldCheck } from 'lucide-react';
import { GoalType } from '@/types/database';

export default function GoalManager() {
  const { user, activeGoal, refreshSession } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType>(activeGoal?.goal_type || 'definition');
  const [weightInput, setWeightInput] = useState(String(user?.current_weight_kg || 75));
  const [copiedToken, setCopiedToken] = useState(false);
  const [webhookSimulating, setWebhookSimulating] = useState(false);
  const [webhookSuccessMsg, setWebhookSuccessMsg] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch {
      // Ignorar
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleUpdateGoal = async (gType: GoalType) => {
    setSelectedGoalType(gType);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_type: gType,
          updated_weight_kg: Number(weightInput),
          notes: `Meta actualizada con peso actual ${weightInput} kg`,
        }),
      });

      if (res.ok) {
        await refreshSession();
        await fetchGoals();
      }
    } catch {
      // Ignorar
    }
  };

  const handleSimulateAppleWatch = async () => {
    if (!user?.webhook_token) return;
    setWebhookSimulating(true);
    setWebhookSuccessMsg(null);

    try {
      const res = await fetch(`/api/health-webhook/${user.webhook_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          active_calories_burned: 540,
          steps: 9200,
          resting_heart_rate: 62,
          weight_kg: Number(weightInput),
        }),
      });

      if (res.ok) {
        setWebhookSuccessMsg('¡Datos sincronizados! 540 kcal activas y 9,200 pasos recibidos.');
        await refreshSession();
      }
    } finally {
      setWebhookSimulating(false);
    }
  };

  const copyWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/api/health-webhook/${user?.webhook_token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleDeleteAccount = async () => {
    const ok = window.confirm('¿Estás completamente seguro de que deseas eliminar tu cuenta y todos tus datos registrados? Esta acción no se puede deshacer.');
    if (ok) {
      await fetch('/api/user/account', { method: 'DELETE' });
      window.location.reload();
    }
  };

  const goalDescriptions: Record<
    GoalType,
    { title: string; deficit: string; protein: string; duration: string; reeval: string }
  > = {
    definition: {
      title: 'Definición',
      deficit: '-15% a -20%',
      protein: '1.8 – 2.2 g/kg',
      duration: '8 – 12 semanas',
      reeval: 'Llegar al % de grasa deseado o registrar caída de fuerza notable.',
    },
    recomposition: {
      title: 'Recomposición',
      deficit: '-5% a 0%',
      protein: '1.8 – 2.0 g/kg',
      duration: '3 – 6 meses',
      reeval: 'Si tras 8-10 semanas no hay cambio visible en cintura o fotos, pasar a Definición.',
    },
    maintenance: {
      title: 'Mantenimiento',
      deficit: '0%',
      protein: '1.6 – 1.8 g/kg',
      duration: 'Sin límite fijo',
      reeval: 'Monitorear estabilidad semanal del peso corporal.',
    },
    bulking: {
      title: 'Volumen',
      deficit: '+5% a +10%',
      protein: '1.6 – 2.0 g/kg',
      duration: '3 – 6 meses',
      reeval: 'Si la ganancia de cintura supera proporcionalmente la ganancia de fuerza.',
    },
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Modificar Peso Actual y Recalcular Metas */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Metas y Cálculo Periodizable
            </h3>
          </div>
          <span className="text-xs text-zinc-400">TDEE recalculable</span>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 block">Tu peso actual de referencia</span>
            <div className="flex items-baseline gap-1 mt-1">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-20 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1 text-lg font-black text-zinc-900 dark:text-white text-center"
              />
              <span className="text-xs font-semibold text-zinc-500">kg</span>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="text-zinc-400 block">Meta Activa</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm capitalize">
              {activeGoal?.goal_type || 'Definición'}
            </span>
            <span className="text-[11px] text-zinc-400 block">
              {activeGoal?.calorie_target} kcal • {activeGoal?.protein_target_g}g prot.
            </span>
          </div>
        </div>

        {/* Métricas Clínicas de Soporte: Fibra, Agua y Piso Calórico */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl border border-teal-200/60 dark:border-teal-800/50">
            <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs mb-0.5">
              <span>🌾 Fibra Dietética</span>
            </div>
            <span className="text-base font-black text-teal-700 dark:text-teal-400">
              {activeGoal?.fiber_target_g || (user?.gender === 'female' ? 25 : 35)}g
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              Meta OMS (14g / 1,000 kcal)
            </span>
          </div>

          <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-2xl border border-sky-200/60 dark:border-sky-800/50">
            <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 font-bold text-xs mb-0.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500" />
              <span>Agua Recomendada</span>
            </div>
            <span className="text-base font-black text-sky-700 dark:text-sky-400">
              {activeGoal?.water_target_ml || Math.round((user?.current_weight_kg || 70) * 35)} ml
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              35 ml/kg de peso corporal
            </span>
          </div>
        </div>

        {/* Alerta Médica: Piso Calórico de Seguridad */}
        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-bold">Piso Calórico de Seguridad Médica Activo:</strong> Mínimo {user?.gender === 'female' ? '1,200' : '1,500'} kcal/día. El sistema bloquea reducciones por debajo de este umbral para evitar la formación de cálculos biliares, caída tiroidea y pérdida de masa magra.
          </p>
        </div>

        {/* Alerta de ritmo saludable de peso */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold">Ritmo recomendado de cambio:</span> 0.3% a 0.7% del peso corporal por semana. Si tu meta activa es Definición, una pérdida mayor a 1% semanal sugiere ajustar el déficit para preservar masa muscular.
          </p>
        </div>

        {/* Selector de los 4 tipos de metas */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
            Seleccionar o cambiar fase nutricional:
          </span>

          {(['definition', 'recomposition', 'maintenance', 'bulking'] as GoalType[]).map((gt) => {
            const info = goalDescriptions[gt];
            const isActive = activeGoal?.goal_type === gt;

            return (
              <div
                key={gt}
                onClick={() => handleUpdateGoal(gt)}
                className={`p-4 rounded-2xl border transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/80 shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      {info.title}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                        Activa
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {info.deficit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                  <span>Proteína: <strong className="text-zinc-800 dark:text-zinc-200">{info.protein}</strong></span>
                  <span>Duración: <strong className="text-zinc-800 dark:text-zinc-200">{info.duration}</strong></span>
                </div>

                <p className="text-[11px] text-zinc-500 border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">Criterio de reevaluación:</span> {info.reeval}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Integración Apple Watch (Apple Shortcuts Webhook) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Integración Apple Watch (Atajos)
            </h3>
          </div>
          <span className="text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
            Sin app nativa
          </span>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Recibe automáticamente tus calorías activas quemadas, pasos y peso desde la app Salud del iPhone a través de un Atajo personalizado.
        </p>

        {/* URL del webhook con token seguro */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
          <span className="text-[11px] font-semibold text-zinc-500 block">Tu URL secreta del Webhook:</span>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 flex-1 truncate text-zinc-700 dark:text-zinc-300">
              /api/health-webhook/{user?.webhook_token}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 transition"
              title="Copiar URL completa"
            >
              {copiedToken ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            </button>
          </div>
        </div>

        {/* Botón de prueba simulada */}
        <div>
          <button
            onClick={handleSimulateAppleWatch}
            disabled={webhookSimulating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            <span>{webhookSimulating ? 'Sincronizando...' : 'Simular sincronización de Apple Watch ahora'}</span>
          </button>
          {webhookSuccessMsg && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center mt-2">
              {webhookSuccessMsg}
            </p>
          )}
        </div>
      </div>

      {/* 3. Exportación y Privacidad de Datos */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          Exportación y Control de Cuenta
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/user/export?format=json"
            download
            className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-center transition flex flex-col items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Descargar JSON</span>
            <span className="text-[10px] text-zinc-400">Respaldo completo</span>
          </a>

          <a
            href="/api/user/export?format=csv"
            download
            className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-center transition flex flex-col items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Descargar CSV</span>
            <span className="text-[10px] text-zinc-400">Comidas en Excel</span>
          </a>
        </div>

        <button
          onClick={handleDeleteAccount}
          className="w-full py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/50 transition flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Eliminar mi cuenta y todos mis datos (Derecho al olvido)</span>
        </button>
      </div>
    </div>
  );
}
