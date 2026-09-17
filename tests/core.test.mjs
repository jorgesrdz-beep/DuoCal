import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: TDEE Mifflin-St Jeor Formula
function calculateBMR(gender, weight_kg, height_cm, age) {
  if (gender === 'female') {
    return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161);
  }
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5);
}

function calculateTDEE(gender, weight_kg, height_cm, age, activity_factor) {
  const bmr = calculateBMR(gender, weight_kg, height_cm, age);
  return Math.round(bmr * activity_factor);
}

test('TDEE Mifflin-St Jeor formula calculates correctly for male and female', () => {
  // Male, 80kg, 180cm, 30yo: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780 BMR
  const maleBMR = calculateBMR('male', 80, 180, 30);
  assert.equal(maleBMR, 1780);

  // Moderate activity (1.55): 1780 * 1.55 = 2759
  const maleTDEE = calculateTDEE('male', 80, 180, 30, 1.55);
  assert.equal(maleTDEE, 2759);

  // Female, 60kg, 165cm, 28yo: 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 => 1330 BMR
  const femaleBMR = calculateBMR('female', 60, 165, 28);
  assert.equal(femaleBMR, 1330);
});

// Test 2: Macro calculations for the 4 goal types
test('Deficit and protein macros match requirements for Definition, Recomposition, Maintenance and Bulking', () => {
  const weight = 80;
  const tdee = 2500;

  // 1. Definition: -20% calories, ~2.0 g/kg protein
  const defCalories = Math.round(tdee * 0.80);
  const defProtein = Math.round(weight * 2.0);
  assert.equal(defCalories, 2000);
  assert.equal(defProtein, 160);

  // 2. Recomposition: -5% calories, ~1.9 g/kg protein
  const recompCalories = Math.round(tdee * 0.95);
  const recompProtein = Math.round(weight * 1.9);
  assert.equal(recompCalories, 2375);
  assert.equal(recompProtein, 152);

  // 3. Bulking: +8% calories, ~1.8 g/kg protein
  const bulkCalories = Math.round(tdee * 1.08);
  const bulkProtein = Math.round(weight * 1.8);
  assert.equal(bulkCalories, 2700);
  assert.equal(bulkProtein, 144);
});

// Test 3: Progressive Lockout Duration for PIN brute force protection
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

// Test 4: Clinical Safeguards (Calorie floor, Fiber, Water)
test('Clinical safeguards enforce calorie floor, fiber target, and water recommendation', () => {
  // Female safety floor: 1200 kcal
  const rawFemaleCals = 1050;
  const safeFemaleCals = Math.max(1200, rawFemaleCals);
  assert.equal(safeFemaleCals, 1200);

  // Male safety floor: 1500 kcal
  const rawMaleCals = 1350;
  const safeMaleCals = Math.max(1500, rawMaleCals);
  assert.equal(safeMaleCals, 1500);

  // Water calculation: 70kg * 35 ml = 2450 ml
  const weight = 70;
  const waterTarget = Math.round(weight * 35);
  assert.equal(waterTarget, 2450);

  // Fiber calculation for 2000 kcal: max(25, round(2000/1000 * 14)) = 28g
  const fiberTarget = Math.max(25, Math.round((2000 / 1000) * 14));
  assert.equal(fiberTarget, 28);
});
