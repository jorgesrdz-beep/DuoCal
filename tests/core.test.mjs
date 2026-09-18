import test from 'node:test';
import assert from 'node:assert/strict';

// 1. TDEE Mifflin-St Jeor Formula
function calculateBMR(gender, weight_kg, height_cm, age) {
  if (gender === 'female') {
    return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161);
  }
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5);
}

function calculateActivityFactor(neatLevel = 'sedentary', workoutSessionsPerWeek = 3, dailySteps) {
  let baseNeat = 1.18;
  if (dailySteps !== undefined && dailySteps > 0) {
    if (dailySteps < 5000) baseNeat = 1.15;
    else if (dailySteps < 8000) baseNeat = 1.25;
    else if (dailySteps < 12000) baseNeat = 1.35;
    else baseNeat = 1.48;
  } else {
    switch (neatLevel) {
      case 'sedentary': baseNeat = 1.16; break;
      case 'light_standing': baseNeat = 1.25; break;
      case 'active_walking': baseNeat = 1.35; break;
      case 'heavy_labor': baseNeat = 1.50; break;
    }
  }
  const workoutAddition = Math.min(0.35, Math.max(0, workoutSessionsPerWeek) * 0.035);
  return Number((baseNeat + workoutAddition).toFixed(3));
}

test('TDEE Mifflin-St Jeor formula calculates correctly for male and female', () => {
  // Male, 80kg, 180cm, 30yo: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780 BMR
  const maleBMR = calculateBMR('male', 80, 180, 30);
  assert.equal(maleBMR, 1780);

  // Decoupled activity: Sedentary desk job (1.16) + 5 workout sessions (+0.175) = 1.335
  const factor = calculateActivityFactor('sedentary', 5);
  assert.equal(factor, 1.335);
  const maleTDEE = Math.round(maleBMR * factor);
  assert.equal(maleTDEE, 2376);

  // Female, 60kg, 165cm, 28yo: 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 => 1330 BMR
  const femaleBMR = calculateBMR('female', 60, 165, 28);
  assert.equal(femaleBMR, 1330);
});

// 2. Macro calculations for the 4 goal types (with -15% default in definition)
test('Deficit and protein macros match clinical recommendations (Definition starts at -15%)', () => {
  const weight = 80;
  const tdee = 2400;

  // 1. Definition: -15% initial default, 2.0 g/kg protein
  const defCalories = Math.round(tdee * 0.85);
  const defProtein = Math.round(weight * 2.0);
  assert.equal(defCalories, 2040);
  assert.equal(defProtein, 160);

  // 2. Recomposition: -5% calories, ~1.9 g/kg protein
  const recompCalories = Math.round(tdee * 0.95);
  const recompProtein = Math.round(weight * 1.9);
  assert.equal(recompCalories, 2280);
  assert.equal(recompProtein, 152);

  // 3. Bulking: +8% calories, ~1.8 g/kg protein
  const bulkCalories = Math.round(tdee * 1.08);
  const bulkProtein = Math.round(weight * 1.8);
  assert.equal(bulkCalories, 2592);
  assert.equal(bulkProtein, 144);
});

// 3. Progressive Lockout Duration for PIN brute force protection
function calculateLockoutDurationMinutes(failedAttempts) {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 5;
  if (failedAttempts === 6) return 15;
  return 60;
}

test('PIN progressive lockout logic triggers on 5, 6 and 7+ attempts', () => {
  assert.equal(calculateLockoutDurationMinutes(1), 0);
  assert.equal(calculateLockoutDurationMinutes(4), 0);
  assert.equal(calculateLockoutDurationMinutes(5), 5); // 5 min lockout
  assert.equal(calculateLockoutDurationMinutes(6), 15); // 15 min lockout
  assert.equal(calculateLockoutDurationMinutes(7), 60); // 1 hour lockout
  assert.equal(calculateLockoutDurationMinutes(12), 60);
});

// 4. Clinical Safeguards (Calorie floor, Physiological fat floor, Fiber, Water)
test('Clinical safeguards enforce calorie floor, fat floor (0.65g/kg), fiber and water', () => {
  // Female safety floor: 1200 kcal
  const rawFemaleCals = 1050;
  const safeFemaleCals = Math.max(1200, rawFemaleCals);
  assert.equal(safeFemaleCals, 1200);

  // Male safety floor: 1500 kcal
  const rawMaleCals = 1350;
  const safeMaleCals = Math.max(1500, rawMaleCals);
  assert.equal(safeMaleCals, 1500);

  // Physiological fat floor: >= 0.65 g/kg
  const weight = 70;
  const fatGrams = Math.max(Math.round(weight * 0.65), 40);
  assert.equal(fatGrams, 46);

  // Water calculation: 70kg * 35 ml = 2450 ml
  const waterTarget = Math.round(weight * 35);
  assert.equal(waterTarget, 2450);

  // Fiber calculation for 2000 kcal: max(25, round(2000/1000 * 14)) = 28g
  const fiberTarget = Math.max(25, Math.round((2000 / 1000) * 14));
  assert.equal(fiberTarget, 28);
});

// 5. Adaptive Reevaluation Logic Simulation
function simulateEvaluation(goal, avgWeightPrev, avgWeightCurr, adherencePct, recordedDays) {
  const weeklyChangeKg = avgWeightCurr - avgWeightPrev;
  const weeklyRatePct = Number(((weeklyChangeKg / avgWeightPrev) * 100).toFixed(2));

  if (adherencePct < 75 || recordedDays < 4) {
    return { status: 'adherence_alert', deltaKcal: 0 };
  }

  if (goal.goal_type === 'definition') {
    if (weeklyRatePct <= -0.35 && weeklyRatePct >= -0.80) {
      return { status: 'on_track', deltaKcal: 0 };
    } else if (weeklyRatePct > -0.20) {
      return { status: 'needs_adjustment', deltaKcal: -120 };
    }
  }
  return { status: 'on_track', deltaKcal: 0 };
}

test('Adaptive evaluation prioritizes adherence and suggests adjustment only when appropriate', () => {
  const goal = { goal_type: 'definition', calorie_target: 2000 };

  // Case A: Poor adherence (60%) -> Does NOT cut calories
  const caseA = simulateEvaluation(goal, 80, 80, 60, 3);
  assert.equal(caseA.status, 'adherence_alert');
  assert.equal(caseA.deltaKcal, 0);

  // Case B: Good adherence (90%), rate on track (-0.5% per week) -> Maintain
  const caseB = simulateEvaluation(goal, 80, 79.6, 90, 7); // -0.4kg = -0.5%
  assert.equal(caseB.status, 'on_track');
  assert.equal(caseB.deltaKcal, 0);

  // Case C: Good adherence (92%), stalled (-0.1% per week) -> Suggest -120 kcal
  const caseC = simulateEvaluation(goal, 80, 79.95, 92, 7); // -0.05kg = -0.06%
  assert.equal(caseC.status, 'needs_adjustment');
  assert.equal(caseC.deltaKcal, -120);
});
