import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot, AlertCircle, RefreshCw, X, ShieldAlert, Cpu, Database, Network } from 'lucide-react';
import { testOllamaConnection, streamOllamaChat, buildFssaiSystemPrompt } from '../services/ollamaService';
import type { ChatMessage } from '../services/ollamaService';
import { isWebGpuSupported, loadWebGpuModel, generateWebGpuResponse } from '../services/transformersService';
import type { ModelLoadProgress } from '../services/transformersService';

interface ChatAuditorProps {
  ingredientsText: string;
  auditSummary: string;
  labelName: string;
  onClose: () => void;
}

export const ChatAuditor: React.FC<ChatAuditorProps> = ({
  ingredientsText,
  auditSummary,
  labelName,
  onClose
}) => {
  const [provider, setProvider] = useState<'ollama' | 'webgpu' | 'gemini'>('gemini'); // Default to gemini if key is available
  const [ollamaUrl, setOllamaUrl] = useState(() => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttps) {
      return '/ollama-api';
    }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:11434`;
  });
  const [ollamaModel, setOllamaModel] = useState('gemma2:2b');
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [checkingOllama, setCheckingOllama] = useState(false);
  
  // WebGPU State
  const [webGpuAvailable, setWebGpuAvailable] = useState(false);
  const [webGpuLoading, setWebGpuLoading] = useState(false);
  const [webGpuProgress, setWebGpuProgress] = useState<ModelLoadProgress | null>(null);
  const [webGpuLoaded, setWebGpuLoaded] = useState(false);

  // Chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Preset suggestions
  const suggestions = [
    "Is this product diabetic friendly?",
    "Expose any misleading marketing claims here.",
    "Explain the safety of the INS additives listed.",
    "Is the calorie difference a red flag?",
    "Is this safe to give to kids under 5?"
  ];

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Initial checks
  useEffect(() => {
    // 1. Check Ollama
    checkOllama();
    // 2. Check WebGPU
    setWebGpuAvailable(isWebGpuSupported());

    // 3. Select default provider
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setProvider('gemini');
    } else {
      setProvider('ollama');
    }

    // Set initial welcome message
    setMessages([
      {
        role: 'assistant',
        content: `Hi! I have loaded the FSSAI audit report for **${labelName}**. \n\nI can help you understand the chemical additives, verify if the calories add up, check for hidden sugars like maltodextrin, and evaluate if this fits your diet. Ask me anything!`
      }
    ]);
  }, [labelName]);

  const checkOllama = async () => {
    setCheckingOllama(true);
    const available = await testOllamaConnection(ollamaUrl);
    setOllamaAvailable(available);
    setCheckingOllama(false);
    if (available && provider === 'ollama') {
      // Keep it as ollama
    }
  };

  const handleLoadWebGpu = async () => {
    setWebGpuLoading(true);
    setError(null);
    try {
      await loadWebGpuModel((progress) => {
        setWebGpuProgress(progress);
        if (progress.status === 'done') {
          setWebGpuLoaded(true);
        }
      });
    } catch (err: any) {
      setError(`Failed to load WebGPU model: ${err.message || err}`);
    } finally {
      setWebGpuLoading(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isGenerating) return;
    
    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const systemPrompt = buildFssaiSystemPrompt(auditSummary, ingredientsText);

    // Initialize temporary assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const updateLastAssistantMessage = (chunk: string) => {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          last.content += chunk;
        }
        return next;
      });
    };

    const setLastAssistantMessage = (content: string) => {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          last.content = content;
        }
        return next;
      });
    };

    try {
      if (provider === 'gemini') {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
          throw new Error("No Gemini API key found. Please add it in settings or select another engine.");
        }

        // Standard fetch to Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemPrompt },
                  ...messages.filter(m => m.role !== 'system').map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` })),
                  { text: `User: ${textToSend}` }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`Gemini Chat API returned ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
        setLastAssistantMessage(responseText);

      } else if (provider === 'ollama') {
        if (!ollamaAvailable) {
          throw new Error(`Ollama is not running on ${ollamaUrl}. Make sure Ollama desktop app is open.`);
        }

        const chatHistory: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.filter(m => m.role !== 'system'),
          userMessage
        ];

        let hasReceivedChunk = false;
        await streamOllamaChat(
          chatHistory,
          (chunk) => {
            if (!hasReceivedChunk) {
              setLastAssistantMessage(''); // Clear the initial loading text
              hasReceivedChunk = true;
            }
            updateLastAssistantMessage(chunk);
          },
          { url: ollamaUrl, model: ollamaModel }
        );

      } else if (provider === 'webgpu') {
        if (!webGpuLoaded) {
          throw new Error("Browser WebGPU model is not loaded yet. Click the load model button first.");
        }
        
        await generateWebGpuResponse(
          systemPrompt,
          textToSend,
          (chunk) => {
            // WebGPU currently generates all at once in transformersService, 
            // so we set it directly when finished
            setLastAssistantMessage(chunk);
          }
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during text generation.");
      // Remove empty assistant message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="glass-panel animated-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '620px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      
      {/* Left Pane: Chat Screen */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border-color)' }}>
        {/* Chat Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', padding: '0.4rem', borderRadius: '8px', background: 'rgba(9, 167, 100, 0.15)', color: 'var(--primary)' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Ask Gemma AI Auditor</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Powered by {provider.toUpperCase()} engine
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Message Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {messages.map((msg, index) => (
            <div 
              key={index} 
              style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              {/* Avatar */}
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                background: msg.role === 'user' ? 'rgba(255,255,255,0.05)' : 'rgba(9, 167, 100, 0.12)',
                color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--primary)',
                border: `1px solid ${msg.role === 'user' ? 'var(--border-color)' : 'rgba(9,167,100,0.2)'}`
              }}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div style={{ 
                padding: '0.85rem 1.1rem', 
                borderRadius: '12px', 
                fontSize: '0.9rem',
                lineHeight: '1.5',
                background: msg.role === 'user' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.18)',
                border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.02)',
                whiteSpace: 'pre-line',
                color: msg.role === 'user' ? '#ffffff' : '#f1f2f6'
              }}>
                {msg.content === '' && isGenerating ? (
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', color: 'var(--text-muted)' }}>
                    Gemma is writing <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></span>
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(235,59,90,0.05)', border: '1px solid rgba(235,59,90,0.1)', color: '#fc5c65', borderRadius: '8px', fontSize: '0.85rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preset Prompt Suggestions */}
        <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {suggestions.map((sug, i) => (
            <button 
              key={i} 
              type="button"
              className="btn btn-secondary" 
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap', borderRadius: '20px' }}
              onClick={() => handleSendMessage(sug)}
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} 
          style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}
        >
          <input 
            type="text" 
            className="input-text" 
            placeholder={isGenerating ? "AI is processing..." : "Ask about additives, calorie logic, diabetes suitability..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating || (provider === 'webgpu' && !webGpuLoaded)}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0.75rem' }}
            disabled={isGenerating || !input.trim() || (provider === 'webgpu' && !webGpuLoaded)}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Right Pane: Engine Config */}
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={16} /> LLM Engine Settings
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Choose how you want to run the Gemma AI Auditor model on your device.
          </p>
        </div>

        {/* Provider Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          
          {/* 1. Gemini API */}
          <button
            type="button"
            className="btn"
            style={{
              justifyContent: 'flex-start',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              textAlign: 'left',
              border: provider === 'gemini' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: provider === 'gemini' ? 'rgba(9, 167, 100, 0.08)' : 'rgba(0,0,0,0.2)',
              color: '#ffffff'
            }}
            onClick={() => setProvider('gemini')}
          >
            <Network size={16} style={{ color: provider === 'gemini' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginLeft: '0.25rem' }}>
              <span style={{ fontWeight: 700 }}>Gemini Flash API</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fast cloud-assisted reasoning</span>
            </div>
          </button>

          {/* 2. Ollama Local */}
          <button
            type="button"
            className="btn"
            style={{
              justifyContent: 'flex-start',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              textAlign: 'left',
              border: provider === 'ollama' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: provider === 'ollama' ? 'rgba(9, 167, 100, 0.08)' : 'rgba(0,0,0,0.2)',
              color: '#ffffff'
            }}
            onClick={() => setProvider('ollama')}
          >
            <Database size={16} style={{ color: provider === 'ollama' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginLeft: '0.25rem' }}>
              <span style={{ fontWeight: 700 }}>Ollama (Local Mac Server)</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Run Gemma on your macOS desktop</span>
            </div>
          </button>

          {/* 3. WebGPU Browser */}
          <button
            type="button"
            className="btn"
            style={{
              justifyContent: 'flex-start',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              textAlign: 'left',
              border: provider === 'webgpu' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: provider === 'webgpu' ? 'rgba(9, 167, 100, 0.08)' : 'rgba(0,0,0,0.2)',
              color: '#ffffff',
              opacity: webGpuAvailable ? 1 : 0.5
            }}
            onClick={() => webGpuAvailable && setProvider('webgpu')}
            disabled={!webGpuAvailable}
          >
            <Cpu size={16} style={{ color: provider === 'webgpu' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginLeft: '0.25rem' }}>
              <span style={{ fontWeight: 700 }}>In-Browser WebGPU</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Purely offline, browser execution</span>
            </div>
          </button>
        </div>

        {/* Sub-panel: Ollama configs */}
        {provider === 'ollama' && (
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Ollama Server
              <button 
                type="button" 
                onClick={checkOllama} 
                className="btn btn-secondary" 
                style={{ padding: '0.2rem', borderRadius: '4px' }} 
                disabled={checkingOllama}
                title="Refresh connection"
              >
                <RefreshCw size={12} className={checkingOllama ? 'spinner' : ''} />
              </button>
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ollamaAvailable ? 'var(--primary)' : 'var(--danger)' }}></span>
              <span style={{ color: 'var(--text-muted)' }}>
                {ollamaAvailable ? 'Connected to server' : 'Ollama not detected'}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Ollama Host URL</label>
              <input 
                type="text" 
                className="input-text" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }} 
                value={ollamaUrl} 
                onChange={(e) => setOllamaUrl(e.target.value)} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Model Identifier</label>
              <input 
                type="text" 
                className="input-text" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }} 
                value={ollamaModel} 
                onChange={(e) => setOllamaModel(e.target.value)} 
              />
            </div>
          </div>
        )}

        {/* Sub-panel: WebGPU loading */}
        {provider === 'webgpu' && (
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.1)' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700 }}>Transformers.js Status</h4>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: webGpuLoaded ? 'var(--primary)' : 'var(--warning)' }}></span>
              <span style={{ color: 'var(--text-muted)' }}>
                {webGpuLoaded ? 'Model Loaded in GPU' : 'Model not loaded'}
              </span>
            </div>

            {!webGpuLoaded && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.5rem', width: '100%', borderRadius: '6px' }}
                onClick={handleLoadWebGpu}
                disabled={webGpuLoading}
              >
                {webGpuLoading ? 'Loading Model...' : 'Load Gemma-2B in Browser'}
              </button>
            )}

            {webGpuProgress && webGpuProgress.status === 'downloading' && (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  <span>Downloading weights...</span>
                  <span>{Math.round(webGpuProgress.progress || 0)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${webGpuProgress.progress || 0}%`, background: 'var(--primary-grad)' }}></div>
                </div>
              </div>
            )}

            {webGpuProgress && webGpuProgress.message && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.3' }}>
                {webGpuProgress.message}
              </p>
            )}
          </div>
        )}

        {/* Sub-panel: Gemini key disclaimer */}
        {provider === 'gemini' && (
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ShieldAlert size={14} /> Cloud-Assisted Mode
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Uses the API key saved in your scanner settings. This executes fast, smart reasoning using Gemini 1.5 Flash. Requires an active internet connection.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
