import { createWorker } from 'tesseract.js';
import type { NutritionalData } from './fssaiRules';

/**
 * Runs client-side local Tesseract OCR on an image file.
 */
export async function performLocalOcr(
  imageFile: File
): Promise<string> {
  const worker = await createWorker('eng');
  
  try {
    // If the progress callback is provided, hook into it
    // Note: createWorker in modern tesseract.js handles progress internally
    // We can monitor it by passing a logger during worker creation.
    // However, let's keep it simple:
    const imageUri = URL.createObjectURL(imageFile);
    const ret = await worker.recognize(imageUri);
    URL.revokeObjectURL(imageUri);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Converts a File object to base64.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Calls Gemini Multimodal API to parse the nutrition label image into structured JSON directly.
 * Using Gemini 2.5 Flash as it is extremely cheap, fast, and excellent at structured extraction.
 */
export async function performGeminiOcr(
  imageFile: File,
  apiKey: string
): Promise<{ nutritionalData: NutritionalData; ingredientsText: string }> {
  const base64Image = await fileToBase64(imageFile);
  const mimeType = imageFile.type;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
  You are an expert food label OCR assistant. Read the nutrition facts label and ingredient list in this image.
  
  Extract the values and return a JSON object containing the fields below.
  Ensure values are represented per 100g or 100ml. If the label provides values "per serving" or "per pack", calculate and convert them to the equivalent per 100g or 100ml based on the serving size and net weight.

  JSON Format:
  {
    "nutritionalData": {
      "energyKcal": <number: energy in kcal per 100g/ml>,
      "carbohydratesG": <number: carbs in grams per 100g/ml>,
      "totalSugarG": <number: total sugar in grams per 100g/ml>,
      "addedSugarG": <number: optional added sugar in grams per 100g/ml>,
      "proteinG": <number: protein in grams per 100g/ml>,
      "totalFatG": <number: fat in grams per 100g/ml>,
      "saturatedFatG": <number: optional saturated fat in grams per 100g/ml>,
      "transFatG": <number: optional trans fat in grams per 100g/ml>,
      "sodiumMg": <number: optional sodium in milligrams per 100g/ml>,
      "fiberG": <number: optional dietary fiber in grams per 100g/ml>,
      "servingSizeGOrMl": <number: serving size in grams or ml (default to 100 if not found)>,
      "isSolid": <boolean: true if product is solid (g), false if liquid (ml)>
    },
    "ingredientsText": "<string: exact comma-separated list of ingredients as printed on the package>"
  }

  Important Notes:
  - If a nutrient is not present or listed on the label, omit the field or set it to 0.
  - Return ONLY valid JSON, do not include markdown code block formatting or other commentary.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("Empty response from Gemini API.");
  }

  const parsed = JSON.parse(textResponse);
  return {
    nutritionalData: parsed.nutritionalData,
    ingredientsText: parsed.ingredientsText
  };
}

/**
 * Fallback prompt to use with local Gemma to structure raw text extracted by Tesseract
 */
export function getLocalGemmaParsingPrompt(rawOcrText: string): string {
  return `
  You are a structured data extractor. Convert the following messy OCR text from a food packaging label into a JSON object.
  
  Rules:
  - Try to find values for: Energy (kcal), Carbohydrates (g), Sugars (g), Added Sugars (g), Protein (g), Total Fat (g), Saturated Fat (g), Trans Fat (g), Sodium (mg), Fiber (g), Serving Size.
  - Normalize values to "per 100g" or "per 100ml". If the OCR text specifies serving size and says "per serving", scale it up.
  - Extract the ingredients list as a single comma-separated text.
  - Return ONLY a raw JSON string matching this shape, with no other text, comments or markdown blocks:
  
  {
    "nutritionalData": {
      "energyKcal": <number>,
      "carbohydratesG": <number>,
      "totalSugarG": <number>,
      "addedSugarG": <number | null>,
      "proteinG": <number>,
      "totalFatG": <number>,
      "saturatedFatG": <number | null>,
      "transFatG": <number | null>,
      "sodiumMg": <number | null>,
      "fiberG": <number | null>,
      "servingSizeGOrMl": <number>,
      "isSolid": <boolean>
    },
    "ingredientsText": "<comma separated ingredients list>"
  }

  Messy OCR Text:
  ------------------
  ${rawOcrText}
  ------------------
  `;
}

/**
 * Cleans common OCR digit representation errors (spaces, commas)
 */
export function cleanOcrText(text: string): string {
  let cleaned = text;
  // Replace commas between digits with periods (e.g. 12,3 -> 12.3)
  cleaned = cleaned.replace(/(\d+)\s*,\s*(\d+)/g, '$1.$2');
  // Remove spaces around periods between digits (e.g. 12 . 3 -> 12.3)
  cleaned = cleaned.replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2');
  // Fix common OCR typos for brackets/letters in values (e.g. "l2.3" -> "12.3", "o.5" -> "0.5")
  // but be careful not to corrupt words. Only do it in number-like zones.
  return cleaned;
}

/**
 * Parses raw OCR text using regex to find key-value nutrition pairs.
 * Uses a distance-tolerant lookahead to skip over units in parentheses (e.g., "(g)", "(kcal)").
 */
export function parseOcrTextWithRegex(text: string): { nutritionalData: NutritionalData; ingredientsText: string } {
  const cleanedText = cleanOcrText(text);
  const normalized = cleanedText.toLowerCase();
  
  // Helper to find a number after a keyword
  const findNutrientValue = (keywords: string[]): number => {
    for (const keyword of keywords) {
      // Matches the keyword, followed by up to 35 characters of non-digits/non-newlines
      // (like spaces, colons, dashes, units e.g., "(g)", "value (kcal)"), and then captures the number.
      // Supports decimals with/without leading zero (e.g. 12.3, 0.5, .25)
      const regex = new RegExp(`\\b${keyword}\\b[^0-9\\n]{0,35}(\\d+(?:\\.\\d+)?|\\.\\d+)`, 'i');
      const match = normalized.match(regex);
      if (match && match[1]) {
        return parseFloat(match[1]);
      }
    }
    return 0;
  };

  const energy = findNutrientValue(['energy value', 'energy', 'calories', 'caloric value', 'kcal']);
  const carbs = findNutrientValue(['carbohydrates', 'carbohydrate', 'total carbohydrate', 'carbs', 'carb']);
  const sugar = findNutrientValue(['total sugars', 'total sugar', 'sugar', 'sugars']);
  const addedSugar = findNutrientValue(['added sugar', 'added sugars', 'added']);
  const protein = findNutrientValue(['protein', 'proteins']);
  const fat = findNutrientValue(['total fat', 'fat', 'fats', 'lipid', 'lipids']);
  const satFat = findNutrientValue(['saturated fat', 'saturated fats', 'saturated', 'sat fat']);
  const transFat = findNutrientValue(['trans fat', 'trans fats', 'trans fat acid', 'trans']);
  const sodium = findNutrientValue(['sodium', 'na', 'salt']);
  const fiber = findNutrientValue(['dietary fiber', 'fiber', 'fibres', 'crude fiber']);
  const servingSize = findNutrientValue(['serving size', 'serv size', 'serving']);

  // Extract ingredients list:
  // Starts with "ingredients:" and matches until the next double newline, period, or other major section
  let ingredients = '';
  const ingMatch = normalized.match(/ingredients\s*[:\-—–]?\s*([\s\S]+?)(?:\.|\n\n|nutrition facts|contains|allergen|manufactured by|$)/i);
  if (ingMatch && ingMatch[1]) {
    ingredients = ingMatch[1]
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    // fallback: if no "ingredients:" label is found, just try to find comma separated list of words
    const fallbackMatch = normalized.match(/([a-zA-Z\s]{3,20},\s*){3,}[a-zA-Z\s]{3,20}/);
    if (fallbackMatch) {
      ingredients = fallbackMatch[0].trim();
    }
  }

  // Determine if it is liquid (if ml is mentioned, but default to solid)
  const isSolid = !normalized.includes(' ml') && !normalized.includes(' liquid');

  return {
    nutritionalData: {
      energyKcal: energy,
      carbohydratesG: carbs,
      totalSugarG: sugar,
      addedSugarG: addedSugar || undefined,
      proteinG: protein,
      totalFatG: fat,
      saturatedFatG: satFat || undefined,
      transFatG: transFat || undefined,
      sodiumMg: sodium || undefined,
      fiberG: fiber || undefined,
      servingSizeGOrMl: servingSize || 100,
      isSolid
    },
    ingredientsText: ingredients
  };
}
