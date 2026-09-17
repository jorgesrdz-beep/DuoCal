'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Flame, Activity, TrendingUp, Users, Calendar, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export default function WeeklyBalanceCard() {
  const { user, partner, activeGoal } = useAuth();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/reports?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch {
      // Ignorar
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
        <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />
      </div>
    );
  }

  const weeklySummary = reportData?.weeklySummary;
  const partnerSummary = reportData?.partnerSummary;
  const dailyData = reportData?.dailyData || [];
  const todayBalance = reportData?.todayBalance;
  const calorieDiff = weeklySummary?.difference || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* 0. Tarjeta: Balance Diario de Hoy (Consumo vs Meta) */}
      {todayBalance && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Balance del Día</span>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Hoy vs Meta Diaria</h3>
              </div>
            </div>

            <span className="text-xs text-zinc-400 font-medium">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Mi Balance Diario */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Tú ({user?.display_name})
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-zinc-900 dark:text-white">
                      {todayBalance.user.calories}
                    </span>
                    <span className="text-xs text-zinc-400">/ {todayBalance.user.targetCalories} kcal</span>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    todayBalance.user.remainingCalories >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {todayBalance.user.remainingCalories >= 0
                    ? `Te faltan ${todayBalance.user.remainingCalories} kcal`
                    : `+${Math.abs(todayBalance.user.remainingCalories)} kcal sobre meta`}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    todayBalance.user.remainingCalories >= 0 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (todayBalance.user.calories / todayBalance.user.targetCalories) * 100)}%` }}
                />
              </div>

              {/* Mini desglose de macros del día */}
              <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div className="p-1 rounded-lg bg-white dark:bg-zinc-900/60">
                  <span className="text-[9px] text-zinc-400 block">Prot</span>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {todayBalance.user.protein}/{todayBalance.user.targetProtein}g
                  </span>
                </div>
                <div className="p-1 rounded-lg bg-white dark:bg-zinc-900/60">
                  <span className="text-[9px] text-zinc-400 block">Carb</span>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {todayBalance.user.carbs}/{todayBalance.user.targetCarbs}g
                  </span>
                </div>
                <div className="p-1 rounded-lg bg-white dark:bg-zinc-900/60">
                  <span className="text-[9px] text-zinc-400 block">Grasa</span>
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {todayBalance.user.fat}/{todayBalance.user.targetFat}g
                  </span>
                </div>
                <div className="p-1 rounded-lg bg-white dark:bg-zinc-900/60">
                  <span className="text-[9px] text-zinc-400 block">Fibra</span>
                  <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                    {todayBalance.user.fiber}/{todayBalance.user.targetFiber}g
                  </span>
                </div>
              </div>
            </div>

            {/* Balance de Compañero/a (Roomie / Duo) Hoy */}
            {todayBalance.partner ? (
              <div className="p-4 bg-teal-50/40 dark:bg-zinc-800/60 rounded-2xl border border-teal-200/50 dark:border-zinc-700/60 flex flex-col justify-between space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      <span>{todayBalance.partner.name} (Roomie / Duo)</span>
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-zinc-900 dark:text-white">
                        {todayBalance.partner.calories}
                      </span>
                      <span className="text-xs text-zinc-400">/ {todayBalance.partner.targetCalories} kcal</span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                    {todayBalance.partner.percent}% completado
                  </span>
                </div>

                {/* Barra de progreso pareja */}
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-all"
                    style={{ width: `${todayBalance.partner.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-teal-100 dark:border-zinc-700/50">
                  <span>
                    {todayBalance.partner.remainingCalories >= 0
                      ? `Le faltan ${todayBalance.partner.remainingCalories} kcal hoy`
                      : `+${Math.abs(todayBalance.partner.remainingCalories)} kcal sobre meta`}
                  </span>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                    Meal Prep Compartido 🍱
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-center text-xs text-zinc-400">
                <Users className="w-6 h-6 mb-1 opacity-40" />
                <span>Vincula a tu compañero/a o roomie para ver su balance calórico diario aquí.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Tarjeta Principal: Balance Semanal Acumulado */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-zinc-800 relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400 block">Indicador Primario</span>
              <h3 className="text-sm font-bold text-white">Balance Semanal Acumulado</h3>
            </div>
          </div>

          <div className="flex bg-zinc-800/80 rounded-xl p-0.5 border border-zinc-700/60 text-xs">
            <button
              onClick={() => setRange('weekly')}
              className={`px-2.5 py-1 rounded-lg transition ${
                range === 'weekly' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setRange('monthly')}
              className={`px-2.5 py-1 rounded-lg transition ${
                range === 'monthly' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
              }`}
            >
              30 Días
            </button>
          </div>
        </div>

        {/* Métrica principal: Promedio vs Meta */}
        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-700/40">
            <span className="text-xs text-zinc-400 block mb-1">Promedio Diario Real</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-white">
                {weeklySummary?.averageCalories || 0}
              </span>
              <span className="text-xs text-zinc-400">kcal/día</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {calorieDiff > 0 ? (
                <span className="text-amber-400 flex items-center font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{calorieDiff} kcal vs meta
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {calorieDiff} kcal vs meta
                </span>
              )}
            </div>
          </div>

          <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-700/40">
            <span className="text-xs text-zinc-400 block mb-1">Meta Asignada</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-emerald-400">
                {weeklySummary?.targetCalories || 0}
              </span>
              <span className="text-xs text-zinc-400">kcal/día</span>
            </div>
            <div className="mt-2 text-xs text-zinc-300 font-medium truncate">
              {activeGoal ? `Meta: ${activeGoal.goal_type}` : 'Sin meta fijada'}
            </div>
          </div>
        </div>

        {/* Banner de evaluación de balance semanal (no castiga días libres) */}
        <div className="mt-4 p-3 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs text-zinc-300 leading-relaxed">
            <span className="font-semibold text-white">Filosofía DuoCal:</span> Evalúa tu balance promedio semanal. Los excesos o comidas libres de fin de semana se equilibran con la estructura fija de lunes a viernes.
          </p>
        </div>
      </div>

      {/* 2. Gráfica de Calorías y Meta */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Historial de Consumo Diario
            </h4>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            Línea verde: Meta ({weeklySummary?.targetCalories} kcal)
          </span>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="dayLabel" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#27272a',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`${val} kcal`, 'Consumidas']}
              />
              <ReferenceLine
                y={weeklySummary?.targetCalories || 2000}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              <Bar dataKey="calories" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Panel de Balance Real: Consumo vs Gasto Apple Watch */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-rose-500" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
            Balance Energético Real (Apple Watch)
          </h4>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] text-zinc-500 block mb-0.5">Consumo Hoy</span>
            <span className="text-base font-bold text-zinc-900 dark:text-white">
              {dailyData[dailyData.length - 1]?.calories || 0} kcal
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] text-zinc-500 block mb-0.5">Quemadas (Watch)</span>
            <span className="text-base font-bold text-rose-600 dark:text-rose-400">
              {dailyData[dailyData.length - 1]?.activeBurned || 0} kcal
            </span>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <span className="text-[11px] text-zinc-500 block mb-0.5">Pasos Hoy</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {dailyData[dailyData.length - 1]?.steps || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Resumen Compartido de Hogar (Roomie / Duo) */}
      {partnerSummary && (
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-zinc-900 dark:to-zinc-900 rounded-3xl p-5 border border-teal-200/60 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                Progreso de {partnerSummary.partnerName} (Roomie / Duo)
              </h4>
            </div>
            <span className="text-[11px] font-medium bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              Sincronización de Hogar
            </span>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
            Monitoreo compartido de metas y meal prep conjunto en el hogar.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-2xl border border-teal-100 dark:border-zinc-700">
              <span className="text-[10px] text-zinc-400 block">Meta Actual</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-white capitalize">
                {partnerSummary.goalType}
              </span>
            </div>

            <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-2xl border border-teal-100 dark:border-zinc-700">
              <span className="text-[10px] text-zinc-400 block">Promedio Semanal</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                {partnerSummary.averageCalories} kcal
              </span>
            </div>

            <div className="p-2.5 bg-white dark:bg-zinc-800 rounded-2xl border border-teal-100 dark:border-zinc-700">
              <span className="text-[10px] text-zinc-400 block">Días Registrados</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {partnerSummary.daysLoggedCount} / 7
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
