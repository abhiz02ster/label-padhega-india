import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, Flame, AlertCircle, Edit2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import type { NutritionalData } from '../engine/fssaiRules';
import { verifyFssaiClaims, calculateRdaPercentage, getHfssWarnings } from '../engine/fssaiRules';
import { auditCalories } from '../engine/calorieEngine';
import { parseIngredients } from '../engine/ingredientsParser';

interface DashboardProps {
  initialNutritionalData: NutritionalData;
  initialIngredientsText: string;
  labelName: string;
  source: string;
  onAskGemma: (data: { nutritionalData: NutritionalData; ingredientsText: string; auditSummary: string }) => void;
  onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  initialNutritionalData,
  initialIngredientsText,
  labelName,
  source,
  onAskGemma,
  onReset,
}) => {
  const [isEditing, setIsEditing] = useState(source === 'manual');
  const [nutrients, setNutrients] = useState<NutritionalData>(initialNutritionalData);
  const [ingredientsText, setIngredientsText] = useState(initialIngredientsText);
  const [basis, setBasis] = useState<'per_100g' | 'per_serving'>(source === 'manual' ? 'per_serving' : 'per_100g');

  // Handle number input changes
  const handleNutrientChange = (key: keyof NutritionalData, val: string | boolean) => {
    setNutrients(prev => ({
      ...prev,
      [key]: typeof val === 'boolean' ? val : Number(val) || 0
    }));
  };

  // Normalize nutrients to 100g base if user inputs per-serving figures
  const normalizedNutrients = useMemo(() => {
    if (basis === 'per_100g') {
      return nutrients;
    }
    const factor = nutrients.servingSizeGOrMl > 0 ? (100 / nutrients.servingSizeGOrMl) : 1;
    return {
      ...nutrients,
      energyKcal: Number((nutrients.energyKcal * factor).toFixed(1)),
      carbohydratesG: Number((nutrients.carbohydratesG * factor).toFixed(2)),
      totalSugarG: Number((nutrients.totalSugarG * factor).toFixed(2)),
      addedSugarG: nutrients.addedSugarG !== undefined ? Number((nutrients.addedSugarG * factor).toFixed(2)) : undefined,
      proteinG: Number((nutrients.proteinG * factor).toFixed(2)),
      totalFatG: Number((nutrients.totalFatG * factor).toFixed(2)),
      saturatedFatG: nutrients.saturatedFatG !== undefined ? Number((nutrients.saturatedFatG * factor).toFixed(2)) : undefined,
      transFatG: nutrients.transFatG !== undefined ? Number((nutrients.transFatG * factor).toFixed(2)) : undefined,
      sodiumMg: nutrients.sodiumMg !== undefined ? Number((nutrients.sodiumMg * factor).toFixed(1)) : undefined,
      fiberG: nutrients.fiberG !== undefined ? Number((nutrients.fiberG * factor).toFixed(2)) : undefined,
    };
  }, [nutrients, basis]);

  // Perform audits reactively based on local state (so edits reflect instantly!)
  const calorieAudit = useMemo(() => auditCalories(normalizedNutrients), [normalizedNutrients]);
  const claimsAudit = useMemo(() => verifyFssaiClaims(normalizedNutrients), [normalizedNutrients]);
  const rdaAudit = useMemo(() => calculateRdaPercentage(normalizedNutrients), [normalizedNutrients]);
  const hfssWarnings = useMemo(() => getHfssWarnings(normalizedNutrients), [normalizedNutrients]);
  const ingredientAudit = useMemo(() => parseIngredients(ingredientsText), [ingredientsText]);

  // Construct a concise text summary to pass to the Chat component for LLM context
  const auditSummaryText = useMemo(() => {
    const claimsStr = claimsAudit
      .map(c => `- ${c.claimName}: ${c.isCompliant ? 'Verified' : 'False Claim (Actual: ' + c.declaredValue + ')'}`)
      .join('\n');
    
    const warningsStr = hfssWarnings.map(w => `- HFSS ${w.nutrient}: ${w.message}`).join('\n');
    const ingredientWarnings = ingredientAudit.keyWarnings.map(w => `- Ingredient: ${w}`).join('\n');

    return `
Product Name: ${labelName}
Declared Calories: ${calorieAudit.declaredEnergy} kcal per 100g/ml
Calculated Calories: ${calorieAudit.calculatedEnergy} kcal per 100g/ml
Calorie Difference: ${calorieAudit.differencePct}% (${calorieAudit.message})

FSSAI Claims Audit:
${claimsStr || 'No specific claims checked.'}

HFSS Warnings:
${warningsStr || 'No nutritional warning levels breached.'}

Ingredient Audit:
Hazard Score: ${ingredientAudit.hazardScore}/100
Warnings:
${ingredientWarnings || 'No severe ingredient hazards flagged.'}
Allergens Detected: ${ingredientAudit.detectedAllergens.join(', ') || 'None flagged'}
    `.trim();
  }, [labelName, calorieAudit, claimsAudit, hfssWarnings, ingredientAudit]);

  // Handler to trigger the AI chat
  const handleAskAI = () => {
    onAskGemma({
      nutritionalData: nutrients,
      ingredientsText,
      auditSummary: auditSummaryText
    });
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #ffffff 0%, #a5b1c2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {labelName}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Analyzed using <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{source.toUpperCase().replace('_', ' ')}</span> mode
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 size={16} /> {isEditing ? 'Save Audited Data' : 'Correct/Edit Label Data'}
          </button>
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={handleAskAI}
          >
            <Sparkles size={16} /> Ask Gemma to Critique
          </button>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={onReset}
            style={{ padding: '0.75rem' }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Unit Basis Selector Toggle */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', gap: '1rem', flexWrap: 'wrap', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Label values represent:</span>
          <span style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 700 }}>
            {basis === 'per_100g' ? 'Per 100g / 100ml' : `Per Serving (${nutrients.servingSizeGOrMl}g/ml)`}
          </span>
        </div>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '0.15rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: basis === 'per_100g' ? 'var(--primary-grad)' : 'transparent',
              color: '#ffffff',
              boxShadow: basis === 'per_100g' ? '0 2px 8px rgba(9, 167, 100, 0.2)' : 'none'
            }}
            onClick={() => setBasis('per_100g')}
          >
            Per 100g/ml
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: basis === 'per_serving' ? 'var(--primary-grad)' : 'transparent',
              color: '#ffffff',
              boxShadow: basis === 'per_serving' ? '0 2px 8px rgba(9, 167, 100, 0.2)' : 'none'
            }}
            onClick={() => setBasis('per_serving')}
          >
            Per Serving
          </button>
        </div>
      </div>

      {/* Editable Fields Section (Accordion Panel) */}
      {isEditing && (
        <div className="glass-panel animated-fade" style={{ padding: '1.5rem', border: '1px solid var(--primary-glow)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <Edit2 size={18} /> Edit Extracted Label Values
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Product Format</label>
              <select 
                className="input-text"
                value={nutrients.isSolid ? 'solid' : 'liquid'}
                onChange={(e) => handleNutrientChange('isSolid', e.target.value === 'solid')}
                style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem' }}
              >
                <option value="solid">Solid (per 100g)</option>
                <option value="liquid">Liquid (per 100ml)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Serving Size (g/ml)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.servingSizeGOrMl} 
                onChange={(e) => handleNutrientChange('servingSizeGOrMl', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Declared Energy (kcal)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.energyKcal} 
                onChange={(e) => handleNutrientChange('energyKcal', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Carbohydrates (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.carbohydratesG} 
                onChange={(e) => handleNutrientChange('carbohydratesG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Total Sugar (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.totalSugarG} 
                onChange={(e) => handleNutrientChange('totalSugarG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Added Sugar (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.addedSugarG || 0} 
                onChange={(e) => handleNutrientChange('addedSugarG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Protein (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.proteinG} 
                onChange={(e) => handleNutrientChange('proteinG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Total Fat (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.totalFatG} 
                onChange={(e) => handleNutrientChange('totalFatG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Saturated Fat (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.saturatedFatG || 0} 
                onChange={(e) => handleNutrientChange('saturatedFatG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Trans Fat (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.transFatG || 0} 
                onChange={(e) => handleNutrientChange('transFatG', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Sodium (mg)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.sodiumMg || 0} 
                onChange={(e) => handleNutrientChange('sodiumMg', e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Dietary Fiber (g)</label>
              <input 
                type="number" 
                className="input-text" 
                value={nutrients.fiberG || 0} 
                onChange={(e) => handleNutrientChange('fiberG', e.target.value)} 
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Ingredients List</label>
            <textarea 
              className="input-text" 
              rows={3} 
              value={ingredientsText} 
              onChange={(e) => setIngredientsText(e.target.value)} 
              style={{ resize: 'vertical', background: 'rgba(0,0,0,0.3)', width: '100%', padding: '0.75rem' }}
            />
          </div>
        </div>
      )}

      {/* Main Dashboard Panel Layout */}
      <div className="dashboard-grid">
        
        {/* Left Column: Calorie Calculations & RDA progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Card 1: Calorie Verification */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 className="card-title">
              <Flame size={20} style={{ color: 'var(--warning)' }} />
              Calorie Audit & Energy Breakdown
            </h2>

            {/* Calorie Audit Status Banner */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'start',
              padding: '1.25rem',
              borderRadius: '12px',
              marginBottom: '2rem',
              background: calorieAudit.severity === 'danger' 
                ? 'rgba(235,59,90,0.08)' 
                : calorieAudit.severity === 'warning' 
                  ? 'rgba(253,150,68,0.08)' 
                  : 'rgba(9,167,100,0.08)',
              borderLeft: `4px solid ${
                calorieAudit.severity === 'danger' 
                  ? 'var(--danger)' 
                  : calorieAudit.severity === 'warning' 
                    ? 'var(--warning)' 
                    : 'var(--primary)'
              }`,
            }}>
              {calorieAudit.severity === 'normal' ? (
                <CheckCircle size={22} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertCircle size={22} style={{ color: calorieAudit.severity === 'danger' ? 'var(--danger)' : 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div>
                <h4 style={{ 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  color: calorieAudit.severity === 'danger' 
                    ? '#fc5c65' 
                    : calorieAudit.severity === 'warning' 
                      ? '#fd9644' 
                      : '#00d284' 
                }}>
                  {calorieAudit.severity === 'danger' 
                    ? 'CRITICAL LABEL MISMATCH' 
                    : calorieAudit.severity === 'warning' 
                      ? 'LABEL WARNING: EXCEEDS TOLERANCE' 
                      : 'MATHEMATICALLY COMPLIANT'
                  }
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  {calorieAudit.message}
                </p>
              </div>
            </div>

            {/* Calories Comparative Display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Declared on Label</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.25rem 0', color: '#ffffff' }}>
                  {basis === 'per_serving' ? nutrients.energyKcal.toFixed(1) : calorieAudit.declaredEnergy.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>kcal</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{basis === 'per_serving' ? `Per ${nutrients.servingSizeGOrMl}g/ml serving` : 'Per 100g/ml'}</span>
              </div>
              
              <div style={{ 
                background: 'rgba(0,0,0,0.15)', 
                padding: '1.25rem', 
                borderRadius: '10px', 
                border: `1px solid ${calorieAudit.isWithinTolerance ? 'var(--border-color)' : 'rgba(235,59,90,0.25)'}`
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mathematically Verified</span>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 800, 
                  margin: '0.25rem 0', 
                  color: calorieAudit.isWithinTolerance ? 'var(--primary)' : 'var(--danger)' 
                }}>
                  {basis === 'per_serving' 
                    ? (calorieAudit.calculatedEnergy * (nutrients.servingSizeGOrMl / 100)).toFixed(1)
                    : calorieAudit.calculatedEnergy.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>kcal</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{basis === 'per_serving' ? `Per ${nutrients.servingSizeGOrMl}g/ml serving` : 'Per 100g/ml'}</span>
              </div>
            </div>

            {/* Macro stacked energy source breakdown */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Energy Source Distribution</h4>
            <div style={{ height: '24px', display: 'flex', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ width: `${calorieAudit.energyBreakdown.carbsPct}%`, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }} title={`Carbs: ${calorieAudit.energyBreakdown.carbsPct}%`}>
                {calorieAudit.energyBreakdown.carbsPct > 10 && 'Carbs'}
              </div>
              <div style={{ width: `${calorieAudit.energyBreakdown.fatPct}%`, background: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }} title={`Fat: ${calorieAudit.energyBreakdown.fatPct}%`}>
                {calorieAudit.energyBreakdown.fatPct > 10 && 'Fats'}
              </div>
              <div style={{ width: `${calorieAudit.energyBreakdown.proteinPct}%`, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }} title={`Protein: ${calorieAudit.energyBreakdown.proteinPct}%`}>
                {calorieAudit.energyBreakdown.proteinPct > 10 && 'Protein'}
              </div>
              {calorieAudit.energyBreakdown.fiberPct > 0 && (
                <div style={{ width: `${calorieAudit.energyBreakdown.fiberPct}%`, background: '#8c7ae6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }} title={`Fiber: ${calorieAudit.energyBreakdown.fiberPct}%`}>
                  {calorieAudit.energyBreakdown.fiberPct > 5 && 'Fiber'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--secondary)', borderRadius: '3px' }}></span>
                <span>Carbs ({nutrients.carbohydratesG}g = {calorieAudit.energyBreakdown.carbsKcal} kcal)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--warning)', borderRadius: '3px' }}></span>
                <span>Fat ({nutrients.totalFatG}g = {calorieAudit.energyBreakdown.fatKcal} kcal)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px' }}></span>
                <span>Protein ({nutrients.proteinG}g = {calorieAudit.energyBreakdown.proteinKcal} kcal)</span>
              </div>
              {nutrients.fiberG ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '12px', height: '12px', background: '#8c7ae6', borderRadius: '3px' }}></span>
                  <span>Fiber ({nutrients.fiberG}g = {calorieAudit.energyBreakdown.fiberKcal} kcal)</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Card 2: RDA Contribution (Per Serving) */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 className="card-title">
              <Info size={20} style={{ color: 'var(--secondary)' }} />
              RDA Allocation per Serving ({nutrients.servingSizeGOrMl}{nutrients.isSolid ? 'g' : 'ml'})
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Shows percentage of recommended daily allowance consumed by one serving (based on average Indian adult 2000 kcal diet guidelines).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Energy RDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Energy</span>
                  <span>{rdaAudit.energy.val.toFixed(0)} / 2000 kcal <strong style={{ color: rdaAudit.energy.pct > 50 ? 'var(--warning)' : '#fff' }}>({rdaAudit.energy.pct.toFixed(0)}%)</strong></span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, rdaAudit.energy.pct)}%`, background: 'var(--secondary-grad)', borderRadius: '4px' }}></div>
                </div>
              </div>

              {/* Total/Added Sugar RDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Added Sugar</span>
                  <span>{rdaAudit.sugar.val.toFixed(1)} / 50 g <strong style={{ color: rdaAudit.sugar.pct > 50 ? 'var(--danger)' : rdaAudit.sugar.pct > 20 ? 'var(--warning)' : '#fff' }}>({rdaAudit.sugar.pct.toFixed(0)}%)</strong></span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, rdaAudit.sugar.pct)}%`, 
                    background: rdaAudit.sugar.pct > 50 ? 'var(--danger-grad)' : rdaAudit.sugar.pct > 25 ? 'var(--warning-grad)' : 'var(--primary-grad)',
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>

              {/* Saturated Fat RDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Saturated Fat</span>
                  <span>{rdaAudit.saturatedFat.val.toFixed(1)} / 22 g <strong style={{ color: rdaAudit.saturatedFat.pct > 50 ? 'var(--danger)' : rdaAudit.saturatedFat.pct > 25 ? 'var(--warning)' : '#fff' }}>({rdaAudit.saturatedFat.pct.toFixed(0)}%)</strong></span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, rdaAudit.saturatedFat.pct)}%`, 
                    background: rdaAudit.saturatedFat.pct > 40 ? 'var(--danger-grad)' : rdaAudit.saturatedFat.pct > 20 ? 'var(--warning-grad)' : 'var(--primary-grad)',
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>

              {/* Sodium RDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Sodium (Salt equivalent: {(rdaAudit.sodium.val * 2.5 / 1000).toFixed(1)}g)</span>
                  <span>{rdaAudit.sodium.val.toFixed(0)} / 2000 mg <strong style={{ color: rdaAudit.sodium.pct > 50 ? 'var(--danger)' : rdaAudit.sodium.pct > 25 ? 'var(--warning)' : '#fff' }}>({rdaAudit.sodium.pct.toFixed(0)}%)</strong></span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, rdaAudit.sodium.pct)}%`, 
                    background: rdaAudit.sodium.pct > 50 ? 'var(--danger-grad)' : rdaAudit.sodium.pct > 25 ? 'var(--warning-grad)' : 'var(--primary-grad)',
                    borderRadius: '4px' 
                  }}></div>
                </div>
              </div>

              {/* Protein RDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Protein (Beneficial Intake)</span>
                  <span>{rdaAudit.protein.val.toFixed(1)} / 54 g <strong style={{ color: 'var(--primary)' }}>({rdaAudit.protein.pct.toFixed(0)}%)</strong></span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, rdaAudit.protein.pct)}%`, background: 'var(--primary-grad)', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Claim Checks, Additive Warning, and Ingredients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Card 3: Claims Audit */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 className="card-title">
              <ShieldAlert size={20} style={{ color: 'var(--primary)' }} />
              Marketing Claims Verification
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              We test standard product labeling claims against FSSAI regulatory definitions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {claimsAudit.map(claim => {
                // Determine if we should display it. If the manufacturer didn't explicitly claim it,
                // it is still helpful to see if the criteria is met.
                const meetsThreshold = claim.isCompliant;
                return (
                  <div 
                    key={claim.claimName} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'start', 
                      gap: '0.75rem',
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.1)',
                      border: `1px solid ${meetsThreshold ? 'rgba(9,167,100,0.1)' : 'rgba(235,59,90,0.1)'}`,
                      borderRadius: '8px'
                    }}
                  >
                    {meetsThreshold ? (
                      <span className="badge badge-success" style={{ padding: '0.25rem', borderRadius: '50%', flexShrink: 0 }}>
                        <CheckCircle size={14} />
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ padding: '0.25rem', borderRadius: '50%', flexShrink: 0 }}>
                        <AlertTriangle size={14} />
                      </span>
                    )}
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{claim.claimName}</span>
                        <span className={`badge ${meetsThreshold ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                          {meetsThreshold ? 'Complies' : 'Breaches Limit'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.3' }}>
                        {claim.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 4: Ingredients Safety Analysis */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 className="card-title">
              <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
              Ingredients & Additive Safety
            </h2>

            {/* Hazard Score Circle Meter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="70" height="70" viewBox="0 0 70 70">
                  <circle cx="35" cy="35" r="30" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle 
                    cx="35" 
                    cy="35" 
                    r="30" 
                    fill="transparent" 
                    stroke={
                      ingredientAudit.hazardScore > 50 
                        ? 'var(--danger)' 
                        : ingredientAudit.hazardScore > 20 
                          ? 'var(--warning)' 
                          : 'var(--primary)'
                    } 
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={2 * Math.PI * 30 * (1 - ingredientAudit.hazardScore / 100)}
                    className="progress-ring-circle"
                  />
                </svg>
                <div style={{ position: 'absolute', fontSize: '1.15rem', fontWeight: 800 }}>
                  {ingredientAudit.hazardScore}
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Ingredient Hazard Score</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {ingredientAudit.hazardScore > 50 
                    ? 'High Caution: Contains multiple chemical additives, hidden sugars, or palm/hydrogenated oil.' 
                    : ingredientAudit.hazardScore > 20 
                      ? 'Moderate Caution: Contains artificial sweeteners, stabilizers, or processed fats.' 
                      : 'Relatively Clean: Low additive footprint and clean base ingredients.'}
                </p>
              </div>
            </div>

            {/* Ingredient Warnings */}
            {ingredientAudit.keyWarnings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {ingredientAudit.keyWarnings.map((warn, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      gap: '0.5rem', 
                      fontSize: '0.85rem', 
                      background: 'rgba(235,59,90,0.03)', 
                      padding: '0.75rem', 
                      borderRadius: '8px', 
                      borderLeft: '3px solid var(--danger)' 
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ lineHeight: '1.3' }}>{warn}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem', background: 'rgba(9,167,100,0.03)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)', marginBottom: '1.5rem' }}>
                <CheckCircle size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>No major chemical hazards, palm oils, or heavy sweeteners identified.</span>
              </div>
            )}

            {/* Allergens Badge Display */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Detected Allergens</h4>
              {ingredientAudit.detectedAllergens.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {ingredientAudit.detectedAllergens.map(allg => (
                    <span key={allg} className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                      ⚠️ {allg}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No common allergens found in ingredients text.</p>
              )}
            </div>

            {/* Clean Ingredients Tag List */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ingredients Breakdown ({ingredientAudit.cleanIngredients.length})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                {ingredientAudit.cleanIngredients.map((ing, idx) => {
                  // highlight if it is a sugar or additive
                  const isSugar = ingredientAudit.detectedSugars.some(s => ing.toLowerCase().includes(s.alias.name));
                  const isAdditive = ingredientAudit.detectedAdditives.some(a => ing.toLowerCase().includes(a.name.toLowerCase()) || ing.toLowerCase().includes(a.code));
                  
                  return (
                    <span 
                      key={idx} 
                      className="badge badge-neutral" 
                      style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.2rem 0.5rem',
                        border: isSugar 
                          ? '1px solid rgba(253, 150, 68, 0.4)' 
                          : isAdditive 
                            ? '1px solid rgba(235, 59, 90, 0.4)' 
                            : '1px solid var(--border-color)',
                        background: isSugar 
                          ? 'rgba(253, 150, 68, 0.08)' 
                          : isAdditive 
                            ? 'rgba(235, 59, 90, 0.08)' 
                            : 'rgba(255,255,255,0.02)',
                        color: isSugar 
                          ? '#fd9644' 
                          : isAdditive 
                            ? '#fc5c65' 
                            : 'var(--text-main)'
                      }}
                      title={isSugar ? 'Sugar Compound' : isAdditive ? 'Additives / E-Number' : 'Base Ingredient'}
                    >
                      {ing}
                    </span>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
