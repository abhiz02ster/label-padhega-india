export interface SugarAlias {
  name: string;
  dangerLevel: 'medium' | 'high';
  description: string;
}

export interface FoodAdditive {
  code: string;
  name: string;
  category: 'color' | 'preservative' | 'sweetener' | 'flavor_enhancer' | 'thickener' | 'emulsifier' | 'other';
  safety: 'safe' | 'caution' | 'hazardous';
  description: string;
}

// 1. Database of common hidden sugars
export const SUGAR_ALIASES: SugarAlias[] = [
  { name: 'maltodextrin', dangerLevel: 'high', description: 'Has a glycemic index (GI) of 85-105, which is higher than table sugar (GI 65). Causes rapid blood sugar spikes.' },
  { name: 'high fructose corn syrup', dangerLevel: 'high', description: 'Highly processed sweetener linked to fatty liver disease, obesity, and insulin resistance.' },
  { name: 'hfcs', dangerLevel: 'high', description: 'Abbreviation for High Fructose Corn Syrup.' },
  { name: 'invert sugar', dangerLevel: 'high', description: 'A liquid sugar mixture of glucose and fructose. Spikes insulin rapidly.' },
  { name: 'invert syrup', dangerLevel: 'high', description: 'Liquid sugar mixture, chemically split sucrose.' },
  { name: 'dextrose', dangerLevel: 'high', description: 'Simple glucose sugar. Spikes blood glucose immediately.' },
  { name: 'glucose syrup', dangerLevel: 'high', description: 'Concentrated liquid glucose derived from starch.' },
  { name: 'glucose-fructose syrup', dangerLevel: 'high', description: 'Another term for high fructose corn syrup derivatives.' },
  { name: 'sucrose', dangerLevel: 'medium', description: 'Standard table sugar. Moderate glycemic impact, but high calorie empty carbs.' },
  { name: 'maltose', dangerLevel: 'medium', description: 'Malt sugar, spikes glucose levels quickly.' },
  { name: 'fructose', dangerLevel: 'medium', description: 'Fruit sugar. Bypasses normal digestion and is processed solely by the liver; excess can lead to fatty liver.' },
  { name: 'corn syrup solids', dangerLevel: 'high', description: 'Dehydrated corn syrup, pure glucose.' },
  { name: 'agave nectar', dangerLevel: 'medium', description: 'Marketed as healthy, but contains up to 85% fructose, putting a heavy load on the liver.' },
  { name: 'honey', dangerLevel: 'medium', description: 'Natural sugar. Healthy in moderation but chemically functions exactly like sugar (spikes glucose).' },
  { name: 'maple syrup', dangerLevel: 'medium', description: 'Natural sugar, high in sucrose.' },
  { name: 'cane sugar', dangerLevel: 'medium', description: 'Refined sugar from sugar cane.' },
  { name: 'liquid sugar', dangerLevel: 'high', description: 'Dissolved sucrose, absorbed very quickly by the body.' },
  { name: 'brown sugar', dangerLevel: 'medium', description: 'White sugar with molasses added back. Same insulin impact.' },
];

// 2. Database of FSSAI / FDA regulated additives (INS / E Numbers)
export const FOOD_ADDITIVES: FoodAdditive[] = [
  // Sweeteners (900-999)
  { code: '951', name: 'Aspartame', category: 'sweetener', safety: 'caution', description: 'Artificial sweetener. WHO classified as "possibly carcinogenic to humans". Can cause headaches or issues in individuals with phenylketonuria (PKU).' },
  { code: '950', name: 'Acesulfame Potassium', category: 'sweetener', safety: 'caution', description: 'Artificial sweetener, often blended with aspartame. Studies suggest potential gut microbiome alteration.' },
  { code: '955', name: 'Sucralose', category: 'sweetener', safety: 'caution', description: 'Chlorinated artificial sweetener. Heat during baking can form toxic compounds; can affect gut bacteria.' },
  { code: '960', name: 'Steviol Glycosides', category: 'sweetener', safety: 'safe', description: 'Natural sweetener extracted from Stevia rebaudiana. Generally safe and does not spike blood sugar.' },
  { code: '965', name: 'Maltitol', category: 'sweetener', safety: 'caution', description: 'Sugar alcohol. Has a GI of 35 (spikes blood sugar slightly) and can cause laxative effects or bloating in medium quantities.' },
  { code: '967', name: 'Xylitol', category: 'sweetener', safety: 'safe', description: 'Sugar alcohol. Low GI, protects teeth, but can cause digestive upset in large amounts. Highly toxic to dogs.' },
  { code: '968', name: 'Erythritol', category: 'sweetener', safety: 'safe', description: 'Zero calorie sugar alcohol. Best tolerated digestive-wise, 0 glycemic index.' },

  // Colors (100-199)
  { code: '102', name: 'Tartrazine (Yellow 5)', category: 'color', safety: 'hazardous', description: 'Synthetic coal-tar dye. Heavily restricted in Europe; linked to hyperactivity in children and allergic asthma.' },
  { code: '110', name: 'Sunset Yellow FCF (Yellow 6)', category: 'color', safety: 'hazardous', description: 'Azo dye. Linked to allergies and hyperactivity in children. Requires warnings in European products.' },
  { code: '122', name: 'Carmoisine', category: 'color', safety: 'hazardous', description: 'Red synthetic dye. Prohibited in USA, Sweden, Norway; linked to allergic reactions and hyperactivity.' },
  { code: '124', name: 'Ponceau 4R', category: 'color', safety: 'hazardous', description: 'Red azo dye. Banned in Norway and USA; suspected carcinogen in high concentrations.' },
  { code: '129', name: 'Allura Red (Red 40)', category: 'color', safety: 'caution', description: 'Azo dye. Linked to immune system reactions and hyperactivity in sensitive children.' },
  { code: '133', name: 'Brilliant Blue FCF', category: 'color', safety: 'caution', description: 'Synthetic blue dye. Banned in several European countries historically; may trigger asthma or skin allergies.' },
  { code: '150c', name: 'Ammonia Caramel (Caramel III)', category: 'color', safety: 'caution', description: 'Caramel color processed with ammonia. High doses linked to digestive issues.' },
  { code: '150d', name: 'Sulphite Ammonia Caramel (Caramel IV)', category: 'color', safety: 'caution', description: 'Most common caramel color (found in colas). Processed with ammonia and sulfites. California Proposition 65 flags its chemical byproduct 4-MEI as a potential carcinogen.' },

  // Preservatives (200-299)
  { code: '211', name: 'Sodium Benzoate', category: 'preservative', safety: 'caution', description: 'Common preservative. Can react with Vitamin C (Ascorbic acid) in drinks to form Benzene, a known carcinogen.' },
  { code: '223', name: 'Sodium Metabisulphite', category: 'preservative', safety: 'hazardous', description: 'Sulphite preservative. Can trigger severe asthmatic attacks, skin rashes, and digestive irritation in sensitive people.' },
  { code: '224', name: 'Potassium Metabisulphite', category: 'preservative', safety: 'hazardous', description: 'Sulphite preservative. Known allergen, dangerous for asthmatics.' },
  { code: '249', name: 'Potassium Nitrite', category: 'preservative', safety: 'hazardous', description: 'Used in processed meats. Can form nitrosamines in the stomach, which are highly carcinogenic.' },
  { code: '250', name: 'Sodium Nitrite', category: 'preservative', safety: 'hazardous', description: 'Common meat preservative. High risk of forming carcinogenic nitrosamines when cooked at high heat.' },

  // Flavor Enhancers (600-699)
  { code: '621', name: 'Monosodium Glutamate (MSG)', category: 'flavor_enhancer', safety: 'caution', description: 'Umami flavor enhancer. Generally safe, but some people experience "MSG sensitivity" (headaches, sweating, flushing).' },
  { code: '627', name: 'Disodium Guanylate', category: 'flavor_enhancer', safety: 'caution', description: 'Synergistic flavor enhancer, always used with MSG. Avoid if you have gout or high uric acid.' },
  { code: '631', name: 'Disodium Inosinate', category: 'flavor_enhancer', safety: 'caution', description: 'Flavor enhancer, acts like MSG. Avoid if suffering from gout.' },

  // Thickeners & Emulsifiers (400-499)
  { code: '407', name: 'Carrageenan', category: 'thickener', safety: 'caution', description: 'Derived from red seaweed. Several studies link it to gut inflammation, bloating, and irritable bowel syndrome (IBS).' },
  { code: '412', name: 'Guar Gum', category: 'thickener', safety: 'safe', description: 'Natural soluble fiber. Safe in food amounts, though excessive amounts can cause gas or laxative effects.' },
  { code: '415', name: 'Xanthan Gum', category: 'thickener', safety: 'safe', description: 'Fermentation-derived thickener. Generally safe, acts as a soluble fiber.' },
  { code: '322', name: 'Lecithins (Soy/Sunflower)', category: 'emulsifier', safety: 'safe', description: 'Natural fat emulsifier. Totally safe, unless you have a severe allergy to the source (e.g. Soy).' },
  { code: '471', name: 'Mono- and Diglycerides of Fatty Acids', category: 'emulsifier', safety: 'safe', description: 'Food emulsifier. Generally safe, though often derived from palm oil or animal fats.' },
];

export interface IngredientsAuditResult {
  rawText: string;
  cleanIngredients: string[];
  detectedSugars: { alias: SugarAlias; foundAs: string }[];
  detectedAdditives: FoodAdditive[];
  detectedAllergens: string[];
  containsPalmOil: boolean;
  palmOilTerms: string[];
  hasHydrogenatedFats: boolean;
  hydrogenatedTerms: string[];
  hazardScore: number; // 0 to 100
  keyWarnings: string[];
}

/**
 * Normalizes and parses the ingredients text to extract hidden compounds, additives, and warnings
 */
export function parseIngredients(rawText: string): IngredientsAuditResult {
  const normalizedText = rawText.toLowerCase();
  
  // Clean punctuation and split into approximate array items
  // Handle commas, semicolons, brackets, and numbers
  const cleanList = rawText
    .replace(/[()[\]{}*]/g, ',') // replace brackets with commas for splitting
    .split(/[,;\n\t]/)
    .map(item => item.trim())
    .filter(item => item.length > 2 && !item.toLowerCase().includes('ingredients:'));

  const cleanIngredients = cleanList;

  // 1. Detect Sugar Aliases
  const detectedSugars: { alias: SugarAlias; foundAs: string }[] = [];
  SUGAR_ALIASES.forEach(sugar => {
    // Check if the alias exists in the text as a separate word/phrase
    const regex = new RegExp(`\\b${sugar.name}\\b`, 'i');
    if (regex.test(normalizedText)) {
      // Find the exact matching string in the ingredients list if possible
      const matchedTerm = cleanList.find(item => item.toLowerCase().includes(sugar.name)) || sugar.name;
      detectedSugars.push({ alias: sugar, foundAs: matchedTerm });
    }
  });

  // 2. Detect Additives (INS / E-numbers)
  // Look for formats: INS 102, INS102, E102, E-102, (102), (ins 102)
  const detectedAdditives: FoodAdditive[] = [];
  FOOD_ADDITIVES.forEach(additive => {
    // Regex matches e.g. "ins 102", "e 102", "ins102", "e102", or code in parentheses "(102)"
    const regex = new RegExp(`\\b(ins|e)?[- ]*\\(?${additive.code}\\b`, 'i');
    
    // Also check if the additive name matches (e.g. "Aspartame" or "Monosodium Glutamate")
    const nameRegex = new RegExp(`\\b${additive.name.toLowerCase()}\\b`, 'i');

    if (regex.test(normalizedText) || nameRegex.test(normalizedText)) {
      detectedAdditives.push(additive);
    }
  });

  // 3. Detect Palm Oil
  const palmOilKeywords = [
    'palm oil', 'palm olein', 'palmolein', 'palm fat', 'palmitate', 
    'fractionated palm', 'palm kernel', 'hydrogenated palm'
  ];
  const palmOilTerms: string[] = [];
  palmOilKeywords.forEach(kw => {
    if (normalizedText.includes(kw)) {
      palmOilTerms.push(kw);
    }
  });
  const containsPalmOil = palmOilTerms.length > 0;

  // 4. Detect Hydrogenated / Trans Fat indicators
  const hydrogenatedKeywords = [
    'hydrogenated', 'partially hydrogenated', 'interesterified', 'margarine', 'shortening', 'vanaspati'
  ];
  const hydrogenatedTerms: string[] = [];
  hydrogenatedKeywords.forEach(kw => {
    if (normalizedText.includes(kw)) {
      hydrogenatedTerms.push(kw);
    }
  });
  const hasHydrogenatedFats = hydrogenatedTerms.length > 0;

  // 5. Detect Allergens
  const allergenDatabase = [
    { name: 'Wheat', keywords: ['wheat', 'maida', 'gluten', 'atta'] },
    { name: 'Milk / Dairy', keywords: ['milk', 'dairy', 'whey', 'casein', 'lactose', 'butter', 'cheese', 'cream', 'skimm'] },
    { name: 'Soy', keywords: ['soy', 'soya', 'lecithin'] }, // note: lecithin is often soy lecithin
    { name: 'Peanut', keywords: ['peanut', 'groundnut'] },
    { name: 'Tree Nuts', keywords: ['cashew', 'almond', 'walnut', 'pistachio', 'hazelnut', 'nut '] },
    { name: 'Sesame', keywords: ['sesame', 'til'] },
    { name: 'Egg', keywords: ['egg', 'albumen'] },
    { name: 'Fish/Shellfish', keywords: ['fish', 'shellfish', 'shrimp', 'crab', 'lobster'] },
    { name: 'Sulphites', keywords: ['sulphite', 'sulfite', 'metabisulphite'] }
  ];
  const detectedAllergens: string[] = [];
  allergenDatabase.forEach(allergen => {
    const found = allergen.keywords.some(kw => normalizedText.includes(kw));
    if (found) {
      detectedAllergens.push(allergen.name);
    }
  });

  // 6. Calculate Hazard Score (0 to 100) and compile key warnings
  let hazardScore = 0;
  const keyWarnings: string[] = [];

  // Sugars
  if (detectedSugars.length > 0) {
    const highSugarCount = detectedSugars.filter(s => s.alias.dangerLevel === 'high').length;
    hazardScore += highSugarCount * 12 + (detectedSugars.length - highSugarCount) * 6;
    if (highSugarCount > 0) {
      keyWarnings.push(`Contains high-glycemic hidden sugars: ${detectedSugars.filter(s => s.alias.dangerLevel === 'high').map(s => s.alias.name).join(', ')}.`);
    }
  }

  // Additives
  if (detectedAdditives.length > 0) {
    const hazardousCount = detectedAdditives.filter(a => a.safety === 'hazardous').length;
    const cautionCount = detectedAdditives.filter(a => a.safety === 'caution').length;
    
    hazardScore += hazardousCount * 20 + cautionCount * 8;
    
    if (hazardousCount > 0) {
      keyWarnings.push(`Contains controversial/harmful additives: ${detectedAdditives.filter(a => a.safety === 'hazardous').map(a => `${a.name} (INS ${a.code})`).join(', ')}.`);
    }
  }

  // Palm Oil
  if (containsPalmOil) {
    hazardScore += 15;
    keyWarnings.push('Contains Palm Oil / Palm Olein, which is high in saturated fats and has poor ecological and health implications.');
  }

  // Hydrogenated fats (direct risk of trans fats)
  if (hasHydrogenatedFats) {
    hazardScore += 25;
    keyWarnings.push('Contains Hydrogenated or Interesterified fats, which pose a severe risk for heart health (trans fat precursors).');
  }

  // Clamp hazard score between 0 and 100
  hazardScore = Math.min(100, hazardScore);

  return {
    rawText,
    cleanIngredients,
    detectedSugars,
    detectedAdditives,
    detectedAllergens,
    containsPalmOil,
    palmOilTerms,
    hasHydrogenatedFats,
    hydrogenatedTerms,
    hazardScore,
    keyWarnings,
  };
}
