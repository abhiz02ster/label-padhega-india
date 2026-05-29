import { useState } from 'react';
import { CameraScanner } from './components/CameraScanner';
import { Dashboard } from './components/Dashboard';
import { ChatAuditor } from './components/ChatAuditor';
import type { NutritionalData } from './engine/fssaiRules';
import { ShieldCheck, Heart, AlertCircle, ArrowLeft } from 'lucide-react';
import './App.css';

type AppPhase = 'scanning' | 'auditing' | 'chatting';

interface ScannedProduct {
  nutritionalData: NutritionalData;
  ingredientsText: string;
  labelName: string;
  source: 'mock' | 'local_ocr' | 'gemini_ocr' | 'manual';
  rawOcrText?: string;
}

function App() {
  const [phase, setPhase] = useState<AppPhase>('scanning');
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [chatContext, setChatContext] = useState<{ auditSummary: string } | null>(null);

  // Callback when scanner successfully completes OCR / returns structured mock
  const handleScanCompleted = (scannedData: ScannedProduct) => {
    setProduct(scannedData);
    setPhase('auditing');
  };

  // Callback when user requests chat from the dashboard
  const handleAskGemma = (data: { auditSummary: string }) => {
    setChatContext(data);
    setPhase('chatting');
  };

  const handleReset = () => {
    setProduct(null);
    setChatContext(null);
    setPhase('scanning');
  };

  return (
    <div className="container">
      {/* App Header */}
      <header className="header">
        <div className="logo-container">
          <span className="logo-icon">🔍</span>
          <span className="logo-text">Label Padhega India</span>
          <span className="logo-badge">FSSAI AUDITOR</span>
        </div>
        
        {phase !== 'scanning' && (
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={handleReset}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            <ArrowLeft size={14} /> Audit Another Food
          </button>
        )}
      </header>

      {/* Main Content Area based on active phase */}
      <main style={{ minHeight: '500px', marginBottom: '3rem' }}>
        {phase === 'scanning' && (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Introduction Hero Section */}
            <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 1rem auto', padding: '1rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem' }}>
                Stop Guessing. <span style={{ background: 'var(--primary-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Audit Your Food.</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Expose misleading packaging claims, calculate true calorie derivations, and scan for hidden chemicals using local artificial intelligence.
              </p>
            </div>

            <CameraScanner onScanCompleted={handleScanCompleted} />
          </div>
        )}

        {phase === 'auditing' && product && (
          <Dashboard 
            initialNutritionalData={product.nutritionalData}
            initialIngredientsText={product.ingredientsText}
            labelName={product.labelName}
            source={product.source}
            onAskGemma={handleAskGemma}
            onReset={handleReset}
          />
        )}

        {phase === 'chatting' && product && chatContext && (
          <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setPhase('auditing')}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <ArrowLeft size={12} /> Back to Dashboard
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Auditing: <strong>{product.labelName}</strong>
              </span>
            </div>

            <ChatAuditor 
              ingredientsText={product.ingredientsText}
              auditSummary={chatContext.auditSummary}
              labelName={product.labelName}
              onClose={() => setPhase('auditing')}
            />
          </div>
        )}
      </main>

      {/* App Footer / FSSAI Reference Card */}
      <footer className="glass-panel" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--primary)' }} /> FSSAI Compliance Guidelines
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            We reference the Food Safety and Standards (Labelling and Display) Regulations, 2020. This includes strict +/- 20% legal calorie tolerances and specific rules for dietary values displayed on packaged commodities sold in India.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Heart size={18} style={{ color: 'var(--danger)' }} /> Nutrition Claim Standards
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            For solids to be claimed as <strong>"Sugar-Free"</strong> or <strong>"Fat-Free"</strong>, they must contain less than 0.5g of sugars/fats per 100g. <strong>"Low Sugar"</strong> claims must not exceed 5g sugars per 100g.
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertCircle size={18} style={{ color: 'var(--warning)' }} /> Disclaimer
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            This application is a digital checker designed to help analyze food labels and locate ingredients. The algorithms are mathematical tools and do not substitute for professional medical or dietary advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
