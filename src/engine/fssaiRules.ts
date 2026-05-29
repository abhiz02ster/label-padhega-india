// FSSAI Food Safety and Standards Regulations thresholds
// Reference: FSS (Labelling and Display) Regulations 2020 & FSS (Advertising and Claims) Regulations 2018

export interface NutritionalData {
  energyKcal: number; // declared per 100g/ml or per serving
  carbohydratesG: number;
  totalSugarG: number;
  addedSugarG?: number;
  proteinG: number;
  totalFatG: number;
  saturatedFatG?: number;
  transFatG?: number;
  sodiumMg?: number;
  fiberG?: number;
  servingSizeGOrMl: number; // serving size in g or ml
  isSolid: boolean; // true for solids (g), false for liquids (ml)
}

// Recommended Dietary Allowance (RDA) for an average Indian adult (2000 kcal diet)
// Source: FSSAI Labelling & Display Regulations 2020
export const FSSAI_RDA = {
  energy: 2000,        // kcal
  addedSugar: 50,      // g (not more than 10% of total energy)
  totalFat: 67,        // g
  saturatedFat: 22,    // g (not more than 10% of total energy)
  transFat: 2,         // g (not more than 1% of total energy)
  sodium: 2000,        // mg (equivalent to 5g salt)
  protein: 54,         // g (approx 0.8g/kg body weight, average 54g for adult)
  carbohydrates: 130,  // g (minimum metabolic requirement, though RDA is usually ~300g)
};

export interface ClaimVerification {
  claimName: string;
  nutrient: keyof NutritionalData;
  declaredValue: number;
  thresholdValue: number;
  isCompliant: boolean;
  explanation: string;
}

/**
 * Verifies if the product meets FSSAI claims criteria (FSS Advertising and Claims Regulations 2018)
 */
export function verifyFssaiClaims(data: NutritionalData): ClaimVerification[] {
  const verifications: ClaimVerification[] = [];
  const unit = data.isSolid ? '100g' : '100ml';

  // 1. SUGAR CLAIMS
  // Low Sugar: solids <= 5g/100g, liquids <= 2.5g/100ml
  const lowSugarThreshold = data.isSolid ? 5 : 2.5;
  verifications.push({
    claimName: 'Low Sugar',
    nutrient: 'totalSugarG',
    declaredValue: data.totalSugarG,
    thresholdValue: lowSugarThreshold,
    isCompliant: data.totalSugarG <= lowSugarThreshold,
    explanation: data.totalSugarG <= lowSugarThreshold
      ? `Complies with FSSAI: Sugar is ${data.totalSugarG}g per ${unit} (Threshold is <= ${lowSugarThreshold}g).`
      : `Fails FSSAI: Sugar is ${data.totalSugarG}g per ${unit}, which exceeds the 'Low Sugar' limit of <= ${lowSugarThreshold}g.`
  });

  // Sugar Free: <= 0.5g/100g or 100ml
  verifications.push({
    claimName: 'Sugar-Free',
    nutrient: 'totalSugarG',
    declaredValue: data.totalSugarG,
    thresholdValue: 0.5,
    isCompliant: data.totalSugarG <= 0.5,
    explanation: data.totalSugarG <= 0.5
      ? `Complies with FSSAI: Sugar is ${data.totalSugarG}g per ${unit} (Threshold is <= 0.5g).`
      : `Fails FSSAI: Sugar is ${data.totalSugarG}g per ${unit}, which exceeds the 'Sugar-Free' limit of <= 0.5g.`
  });

  // 2. FAT CLAIMS
  // Low Fat: solids <= 3g/100g, liquids <= 1.5g/100ml
  const lowFatThreshold = data.isSolid ? 3 : 1.5;
  verifications.push({
    claimName: 'Low Fat',
    nutrient: 'totalFatG',
    declaredValue: data.totalFatG,
    thresholdValue: lowFatThreshold,
    isCompliant: data.totalFatG <= lowFatThreshold,
    explanation: data.totalFatG <= lowFatThreshold
      ? `Complies with FSSAI: Total fat is ${data.totalFatG}g per ${unit} (Threshold is <= ${lowFatThreshold}g).`
      : `Fails FSSAI: Total fat is ${data.totalFatG}g per ${unit}, which exceeds the 'Low Fat' limit of <= ${lowFatThreshold}g.`
  });

  // Fat Free: <= 0.5g/100g or 100ml
  verifications.push({
    claimName: 'Fat-Free',
    nutrient: 'totalFatG',
    declaredValue: data.totalFatG,
    thresholdValue: 0.5,
    isCompliant: data.totalFatG <= 0.5,
    explanation: data.totalFatG <= 0.5
      ? `Complies with FSSAI: Total fat is ${data.totalFatG}g per ${unit} (Threshold is <= 0.5g).`
      : `Fails FSSAI: Total fat is ${data.totalFatG}g per ${unit}, which exceeds the 'Fat-Free' limit of <= 0.5g.`
  });

  // Saturated Fat Free: <= 0.1g/100g or 100ml
  if (data.saturatedFatG !== undefined) {
    verifications.push({
      claimName: 'Saturated Fat-Free',
      nutrient: 'saturatedFatG',
      declaredValue: data.saturatedFatG,
      thresholdValue: 0.1,
      isCompliant: data.saturatedFatG <= 0.1,
      explanation: data.saturatedFatG <= 0.1
        ? `Complies with FSSAI: Saturated fat is ${data.saturatedFatG}g per ${unit} (Threshold is <= 0.1g).`
        : `Fails FSSAI: Saturated fat is ${data.saturatedFatG}g per ${unit}, which exceeds the 'Saturated Fat-Free' limit of <= 0.1g.`
    });
  }

  // 3. PROTEIN CLAIMS
  // Source of Protein: solids >= 10% of RDA (5.4g per 100g), liquids >= 5% of RDA (2.7g per 100ml)
  const sourceProteinThreshold = data.isSolid 
    ? 0.10 * FSSAI_RDA.protein // 5.4g
    : 0.05 * FSSAI_RDA.protein; // 2.7g
  verifications.push({
    claimName: 'Source of Protein',
    nutrient: 'proteinG',
    declaredValue: data.proteinG,
    thresholdValue: Number(sourceProteinThreshold.toFixed(2)),
    isCompliant: data.proteinG >= sourceProteinThreshold,
    explanation: data.proteinG >= sourceProteinThreshold
      ? `Complies with FSSAI: Protein is ${data.proteinG}g per ${unit} (Threshold is >= ${sourceProteinThreshold.toFixed(1)}g).`
      : `Fails FSSAI: Protein is ${data.proteinG}g per ${unit}, which is below the 'Source of Protein' threshold of >= ${sourceProteinThreshold.toFixed(1)}g.`
  });

  // High Protein: solids >= 20% of RDA (10.8g per 100g), liquids >= 10% of RDA (5.4g per 100ml)
  const highProteinThreshold = data.isSolid 
    ? 0.20 * FSSAI_RDA.protein // 10.8g
    : 0.10 * FSSAI_RDA.protein; // 5.4g
  verifications.push({
    claimName: 'High Protein',
    nutrient: 'proteinG',
    declaredValue: data.proteinG,
    thresholdValue: Number(highProteinThreshold.toFixed(2)),
    isCompliant: data.proteinG >= highProteinThreshold,
    explanation: data.proteinG >= highProteinThreshold
      ? `Complies with FSSAI: Protein is ${data.proteinG}g per ${unit} (Threshold is >= ${highProteinThreshold.toFixed(1)}g).`
      : `Fails FSSAI: Protein is ${data.proteinG}g per ${unit}, which is below the 'High Protein' threshold of >= ${highProteinThreshold.toFixed(1)}g.`
  });

  return verifications;
}

/**
 * Calculates the percentage of daily RDA contribution for a serving of the product
 */
export function calculateRdaPercentage(data: NutritionalData, quantityGOrMl: number = data.servingSizeGOrMl) {
  // Convert 100g/ml values to per-serving values
  const factor = quantityGOrMl / 100;
  const servingEnergy = data.energyKcal * factor;
  const servingProtein = data.proteinG * factor;
  const servingFat = data.totalFatG * factor;
  const servingSugar = (data.addedSugarG !== undefined ? data.addedSugarG : data.totalSugarG) * factor;
  const servingSaturatedFat = (data.saturatedFatG !== undefined ? data.saturatedFatG : 0) * factor;
  const servingTransFat = (data.transFatG !== undefined ? data.transFatG : 0) * factor;
  const servingSodium = (data.sodiumMg !== undefined ? data.sodiumMg : 0) * factor;

  return {
    energy: { val: servingEnergy, pct: (servingEnergy / FSSAI_RDA.energy) * 100 },
    protein: { val: servingProtein, pct: (servingProtein / FSSAI_RDA.protein) * 100 },
    fat: { val: servingFat, pct: (servingFat / FSSAI_RDA.totalFat) * 100 },
    sugar: { val: servingSugar, pct: (servingSugar / FSSAI_RDA.addedSugar) * 100 },
    saturatedFat: { val: servingSaturatedFat, pct: (servingSaturatedFat / FSSAI_RDA.saturatedFat) * 100 },
    transFat: { val: servingTransFat, pct: (servingTransFat / FSSAI_RDA.transFat) * 100 },
    sodium: { val: servingSodium, pct: (servingSodium / FSSAI_RDA.sodium) * 100 },
  };
}

/**
 * Detects if a product is High in Fat, Sugar, or Salt (HFSS) warning levels per FSSAI draft thresholds.
 * Thresholds vary but generally:
 * - Sugar: > 10% of energy from added sugar (~ 5g per 100g for solids)
 * - Saturated Fat: > 10% of energy (~ 2.2g per 100g for solids)
 * - Sodium: > 1mg per 1 kcal or > 625mg/100g for solids (varies by category)
 */
export function getHfssWarnings(data: NutritionalData) {
  const warnings: { nutrient: string; value: number; limit: number; message: string; severity: 'high' | 'warning' }[] = [];
  
  // Sugar Warning (> 10% of daily limit per 100g, or high concentration)
  const sugarPer100 = data.totalSugarG;
  if (sugarPer100 > 15) {
    warnings.push({
      nutrient: 'Sugar',
      value: sugarPer100,
      limit: 15,
      severity: 'high',
      message: `Critical: Extremely high sugar content (${sugarPer100}g per 100g). A single serving provides a massive portion of your daily recommended limit.`
    });
  } else if (sugarPer100 > 8) {
    warnings.push({
      nutrient: 'Sugar',
      value: sugarPer100,
      limit: 8,
      severity: 'warning',
      message: `Warning: Moderately high sugar content (${sugarPer100}g per 100g).`
    });
  }

  // Saturated Fat Warning (> 8g per 100g)
  if (data.saturatedFatG !== undefined) {
    if (data.saturatedFatG > 8) {
      warnings.push({
        nutrient: 'Saturated Fat',
        value: data.saturatedFatG,
        limit: 8,
        severity: 'high',
        message: `Critical: Very high saturated fat (${data.saturatedFatG}g per 100g), exceeding recommended heart-healthy thresholds.`
      });
    } else if (data.saturatedFatG > 4) {
      warnings.push({
        nutrient: 'Saturated Fat',
        value: data.saturatedFatG,
        limit: 4,
        severity: 'warning',
        message: `Warning: Elevated saturated fat content (${data.saturatedFatG}g per 100g).`
      });
    }
  }

  // Sodium Warning (> 500mg per 100g)
  if (data.sodiumMg !== undefined) {
    if (data.sodiumMg > 600) {
      warnings.push({
        nutrient: 'Sodium',
        value: data.sodiumMg,
        limit: 600,
        severity: 'high',
        message: `Critical: Extremely high sodium/salt content (${data.sodiumMg}mg per 100g). Consuming high sodium is linked to hypertension.`
      });
    } else if (data.sodiumMg > 300) {
      warnings.push({
        nutrient: 'Sodium',
        value: data.sodiumMg,
        limit: 300,
        severity: 'warning',
        message: `Warning: High sodium content (${data.sodiumMg}mg per 100g).`
      });
    }
  }

  // Trans Fat Warning (> 0g, FSSAI mandates <= 1% energy and targetting 0g trans fats)
  if (data.transFatG !== undefined && data.transFatG > 0) {
    warnings.push({
      nutrient: 'Trans Fat',
      value: data.transFatG,
      limit: 0,
      severity: 'high',
      message: `Critical: Contains trans fats (${data.transFatG}g per 100g). Trans fats are highly industrial and harmful to cardiovascular health. FSSAI requires trans fats to be virtually zero.`
    });
  }

  return warnings;
}
