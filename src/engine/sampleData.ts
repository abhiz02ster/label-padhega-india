import type { NutritionalData } from './fssaiRules';

export interface SampleLabel {
  id: string;
  name: string;
  category: string;
  description: string;
  nutritionalData: NutritionalData;
  ingredientsText: string;
  declaredEnergy: number; // declared calories to display/test against
}

export const SAMPLE_LABELS: SampleLabel[] = [
  {
    id: 'sample-noodles',
    name: 'Spicy Instant Noodles (70g Pack)',
    category: 'Packaged Meal',
    description: 'A classic instant noodle package. Illustrates extremely high sodium, presence of Palm Oil, MSG, and moderate calorie underreporting.',
    declaredEnergy: 280, // Declared per 100g
    nutritionalData: {
      energyKcal: 280, // Declared on package
      carbohydratesG: 62.5, // 62.5g * 4 = 250 kcal
      totalSugarG: 2.1,
      proteinG: 9.0, // 9.0g * 4 = 36 kcal
      totalFatG: 16.5, // 16.5g * 9 = 148.5 kcal
      saturatedFatG: 7.8,
      transFatG: 0.1,
      sodiumMg: 1180, // Very high sodium!
      fiberG: 3.5, // 3.5g * 2 = 7 kcal
      // Calculated total: 250 + 36 + 148.5 + 7 = 441.5 kcal.
      // 280 declared vs 441.5 calculated is a huge -36.6% discrepancy! Underreporting calories!
      servingSizeGOrMl: 70,
      isSolid: true
    },
    ingredientsText: 'Wheat Flour (Maida), Palm Oil, Salt, Wheat Gluten, Mineral (Calcium Carbonate), Gelling Agent (INS 508), Acidity Regulator (INS 501(i), INS 500(i)), Humectant (INS 451(i)), Flavor Enhancer (INS 621 / Monosodium Glutamate), Hydrolyzed Groundnut Protein, Sugar, Spices, Flavor Enhancers (INS 627, INS 631).'
  },
  {
    id: 'sample-bar',
    name: 'Choco-Almond "Gym Fit" Protein Bar (50g)',
    category: 'Health Supplement / Snack',
    description: 'Promoted as "Low Fat", "Sugar-Free", and "High Protein". Illustrates false claims checking, hidden sugars (maltodextrin, invert syrup), and additives.',
    declaredEnergy: 420, // Declared per 100g (equivalent to 210 kcal per 50g serving)
    nutritionalData: {
      energyKcal: 420,
      carbohydratesG: 44.0, // 44 * 4 = 176 kcal
      totalSugarG: 8.0, // Fails Sugar-Free claim (must be <= 0.5g/100g)
      proteinG: 40.0, // 40 * 4 = 160 kcal. (Passes High Protein!)
      totalFatG: 10.0, // 10 * 9 = 90 kcal. (Fails Low Fat claim: must be <= 3g/100g)
      saturatedFatG: 5.2,
      transFatG: 0.0,
      sodiumMg: 120,
      fiberG: 12.0, // 12 * 2 = 24 kcal
      // Calculated total: 176 + 160 + 90 + 24 = 450 kcal.
      // 420 declared vs 450 calculated is -6.7% difference (legal FSSAI tolerance, but flags false claims)
      servingSizeGOrMl: 50,
      isSolid: true
    },
    ingredientsText: 'Soy Protein Isolate, Whey Protein Concentrate, Maltodextrin, Invert Syrup, Almonds (10%), Humectant (Glycerol), Palm Kernel Oil, Cocoa Powder, Emulsifier (INS 322 / Lecithin), Sweetener (INS 955 / Sucralose), Preservative (INS 211 / Sodium Benzoate).'
  },
  {
    id: 'sample-cola',
    name: 'Zero Sugar Sparkly Cola (250ml)',
    category: 'Beverage',
    description: 'A diet soft drink. Illustrates zero-sugar compliance, but highlights synthetic food coloring, artificial sweeteners, and carcinogenic preservative risks.',
    declaredEnergy: 0.2, // Declared per 100ml
    nutritionalData: {
      energyKcal: 0.2,
      carbohydratesG: 0.0,
      totalSugarG: 0.0, // Complies with Sugar-Free!
      proteinG: 0.0,
      totalFatG: 0.0,
      saturatedFatG: 0.0,
      transFatG: 0.0,
      sodiumMg: 12,
      fiberG: 0.0,
      servingSizeGOrMl: 250,
      isSolid: false
    },
    ingredientsText: 'Carbonated Water, Acidity Regulators (INS 330, INS 338), Sweeteners (INS 951 / Aspartame, INS 950 / Acesulfame Potassium), Preservative (INS 211 / Sodium Benzoate), Caffeine, Colour (INS 150d / Sulphite Ammonia Caramel).'
  }
];
export const SAMPLE_IMAGES = {
  'sample-noodles': '🍜 Spicy Noodles Label',
  'sample-bar': '🍫 Gym Fit Protein Bar Label',
  'sample-cola': '🥤 Zero Sugar Cola Label'
};
