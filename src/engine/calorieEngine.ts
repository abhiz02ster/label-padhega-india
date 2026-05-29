import type { NutritionalData } from './fssaiRules';

export interface CalorieAuditResult {
  declaredEnergy: number;
  calculatedEnergy: number;
  differenceKcal: number;
  differencePct: number;
  isWithinTolerance: boolean; // FSSAI allows +/- 20% deviation
  severity: 'normal' | 'warning' | 'danger';
  message: string;
  energyBreakdown: {
    carbsKcal: number;
    proteinKcal: number;
    fatKcal: number;
    fiberKcal: number;
    carbsPct: number;
    proteinPct: number;
    fatPct: number;
    fiberPct: number;
  };
}

/**
 * Audit energy value (calories) against macronutrients declaration
 * FSSAI conversion factors: Carbs = 4 kcal/g, Protein = 4 kcal/g, Fat = 9 kcal/g, Fiber = 2 kcal/g
 */
export function auditCalories(data: NutritionalData): CalorieAuditResult {
  const carbsKcal = data.carbohydratesG * 4;
  const proteinKcal = data.proteinG * 4;
  const fatKcal = data.totalFatG * 9;
  const fiberKcal = (data.fiberG || 0) * 2;

  const calculatedEnergy = Number((carbsKcal + proteinKcal + fatKcal + fiberKcal).toFixed(1));
  const declaredEnergy = data.energyKcal;

  const differenceKcal = Number((declaredEnergy - calculatedEnergy).toFixed(1));
  
  // Calculate percentage difference relative to the calculated value
  // If calculated energy is 0, avoid division by zero
  const differencePct = calculatedEnergy > 0 
    ? Number(((differenceKcal / calculatedEnergy) * 100).toFixed(1))
    : 0;

  // FSSAI regulation specifies that the nutritional value should not deviate by more than +/- 20%
  // of the declared value on the label.
  const tolerancePct = 20;
  const isWithinTolerance = Math.abs(differencePct) <= tolerancePct;

  let severity: 'normal' | 'warning' | 'danger' = 'normal';
  let message = '';

  if (isWithinTolerance) {
    severity = 'normal';
    if (Math.abs(differencePct) < 5) {
      message = 'Excellent: The declared calories perfectly match the nutritional breakdown.';
    } else {
      message = `Compliant: The declared calories (${declaredEnergy} kcal) match the calculated breakdown (${calculatedEnergy} kcal) within the legal FSSAI 20% tolerance limit (${differencePct}% difference).`;
    }
  } else {
    if (differencePct < -tolerancePct) {
      // Declared is much less than calculated (underreporting calories!)
      severity = 'danger';
      message = `Critical Calorie Underreporting: The declared value of ${declaredEnergy} kcal is significantly lower than the calculated ${calculatedEnergy} kcal (${Math.abs(differencePct)}% underreported). This could be an intentional attempt to make the food look less fattening or lower in calories.`;
    } else {
      // Declared is much higher than calculated (overreporting calories or calculation error)
      severity = 'warning';
      message = `Calorie Discrepancy: The declared value of ${declaredEnergy} kcal is higher than the calculated value of ${calculatedEnergy} kcal (+${differencePct}% difference). This exceeds the FSSAI tolerance, indicating potential labeling error.`;
    }
  }

  // Energy source percentages
  const totalCalculated = calculatedEnergy || 1; // avoid division by zero
  const carbsPct = Number(((carbsKcal / totalCalculated) * 100).toFixed(1));
  const proteinPct = Number(((proteinKcal / totalCalculated) * 100).toFixed(1));
  const fatPct = Number(((fatKcal / totalCalculated) * 100).toFixed(1));
  const fiberPct = Number(((fiberKcal / totalCalculated) * 100).toFixed(1));

  return {
    declaredEnergy,
    calculatedEnergy,
    differenceKcal,
    differencePct,
    isWithinTolerance,
    severity,
    message,
    energyBreakdown: {
      carbsKcal,
      proteinKcal,
      fatKcal,
      fiberKcal,
      carbsPct,
      proteinPct,
      fatPct,
      fiberPct,
    }
  };
}
