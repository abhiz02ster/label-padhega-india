import React, { useState, useRef } from 'react';
import { Upload, Camera, Sparkles, AlertCircle, Key, FileText } from 'lucide-react';
import { performLocalOcr, performGeminiOcr, parseOcrTextWithRegex } from '../engine/ocrService';
import { SAMPLE_LABELS } from '../engine/sampleData';
import type { SampleLabel } from '../engine/sampleData';
import type { NutritionalData } from '../engine/fssaiRules';

interface CameraScannerProps {
  onScanCompleted: (data: {
    nutritionalData: NutritionalData;
    ingredientsText: string;
    labelName: string;
    source: 'mock' | 'local_ocr' | 'gemini_ocr' | 'manual';
    rawOcrText?: string;
  }) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanCompleted }) => {
  const [dragActive, setDragActive] = useState(false);
  const [ocrEngine, setOcrEngine] = useState<'local' | 'gemini'>('local');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save API Key
  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', apiKey);
    setShowKeyInput(false);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImageFile(e.target.files[0]);
    }
  };

  // Trigger File Input Click
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Process selected file
  const processImageFile = async (file: File) => {
    setError(null);
    setLoading(true);
    
    if (ocrEngine === 'gemini') {
      if (!apiKey) {
        setError('Gemini API Key is required for Advanced OCR mode. Please add your key in the settings panel.');
        setLoading(false);
        return;
      }

      setLoadingStatus('Uploading image and running Gemini Vision analysis...');
      try {
        const result = await performGeminiOcr(file, apiKey);
        onScanCompleted({
          nutritionalData: result.nutritionalData,
          ingredientsText: result.ingredientsText,
          labelName: file.name,
          source: 'gemini_ocr'
        });
      } catch (err: any) {
        console.error(err);
        setError(`Gemini Extraction Failed: ${err.message || err}. Ensure your API key is valid.`);
      } finally {
        setLoading(false);
      }
    } else {
      // Local Tesseract OCR
      setLoadingStatus('Pre-processing image (contrast enhancement)...');
      try {
        const processedBlob = await preprocessImageForOcr(file);
        const processedFile = new File([processedBlob], file.name, { type: 'image/jpeg' });
        
        setLoadingStatus('Initializing Tesseract OCR Engine (Local)...');
        const rawText = await performLocalOcr(processedFile);
        
        setLoadingStatus('Text extracted. Parsing fields using regex matching rules...');
        const parsed = parseOcrTextWithRegex(rawText);
        
        onScanCompleted({
          nutritionalData: parsed.nutritionalData,
          ingredientsText: parsed.ingredientsText,
          labelName: file.name,
          source: 'local_ocr',
          rawOcrText: rawText
        });
      } catch (err: any) {
        console.error(err);
        setError(`Local OCR Failed: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Camera Handlers
  const startCamera = async () => {
    setError(null);
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please upload an image instead.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `captured-label-${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera();
            processImageFile(file);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  // Demo Load Handler
  const handleLoadDemo = (sample: SampleLabel) => {
    setError(null);
    setLoading(true);
    setLoadingStatus(`Loading demo label data for "${sample.name}"...`);
    
    setTimeout(() => {
      onScanCompleted({
        nutritionalData: sample.nutritionalData,
        ingredientsText: sample.ingredientsText,
        labelName: sample.name,
        source: 'mock'
      });
      setLoading(false);
    }, 600);
  };

  const handleManualEntry = () => {
    onScanCompleted({
      nutritionalData: {
        energyKcal: 0,
        carbohydratesG: 0,
        totalSugarG: 0,
        proteinG: 0,
        totalFatG: 0,
        servingSizeGOrMl: 100,
        isSolid: true
      },
      ingredientsText: '',
      labelName: 'Custom Food Product',
      source: 'manual'
    });
  };

  return (
    <div className="glass-panel glow-green animated-fade" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Analyze Food Label</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Upload, snap, or select a demo food label to audit.
          </p>
        </div>

        {/* Engine Toggles */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '8px' }}>
          <button 
            type="button"
            className={`btn`} 
            style={{ 
              padding: '0.4rem 0.8rem', 
              fontSize: '0.8rem', 
              borderRadius: '6px',
              background: ocrEngine === 'local' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: ocrEngine === 'local' ? '#ffffff' : 'var(--text-muted)'
            }}
            onClick={() => setOcrEngine('local')}
          >
            Local OCR (Offline)
          </button>
          <button 
            type="button"
            className={`btn`} 
            style={{ 
              padding: '0.4rem 0.8rem', 
              fontSize: '0.8rem', 
              borderRadius: '6px',
              background: ocrEngine === 'gemini' ? 'var(--primary)' : 'transparent',
              color: '#ffffff'
            }}
            onClick={() => {
              setOcrEngine('gemini');
              if (!apiKey) setShowKeyInput(true);
            }}
          >
            <Sparkles size={12} /> Gemini OCR (Structured)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: '6px' }}
            onClick={() => setShowKeyInput(!showKeyInput)}
            title="Gemini API Key Settings"
          >
            <Key size={14} />
          </button>
        </div>
      </div>

      {/* API Key Modal / Form */}
      {showKeyInput && (
        <form onSubmit={handleSaveApiKey} className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid var(--border-glow)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Key size={16} /> Enter Gemini API Key
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            To use Advanced OCR, enter your Google AI Studio API key. It is saved locally in your browser.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="password" 
              className="input-text" 
              placeholder="AIzaSy..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Save</button>
          </div>
        </form>
      )}

      {error && (
        <div className="glass-panel" style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--danger)', background: 'rgba(235,59,90,0.05)' }}>
          <AlertCircle className="pulse-danger" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} size={18} />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fc5c65' }}>Scanning Error</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
          <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '4px', marginBottom: '1.5rem' }}></div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Extracting Label Information...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{loadingStatus}</p>
        </div>
      ) : cameraActive ? (
        /* Camera Preview Screen */
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', background: '#000', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
          />
          <div style={{ padding: '1rem', display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
            <button type="button" onClick={capturePhoto} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
              <Camera size={18} /> Take Photo
            </button>
            <button type="button" onClick={stopCamera} className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Main Selection Grid */
        <div>
          {/* Drag & Drop File Area */}
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            style={{
              border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border-color)'}`,
              borderRadius: '12px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragActive ? 'rgba(9, 167, 100, 0.05)' : 'rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease',
              marginBottom: '2rem'
            }}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              <Upload size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Drag & Drop your food label image
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Or click to browse files from your computer
            </p>
            <div style={{ margin: '1.25rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ height: '1px', width: '40px', background: 'var(--border-color)' }}></span>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>OR</span>
              <span style={{ height: '1px', width: '40px', background: 'var(--border-color)' }}></span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
              >
                <Camera size={14} /> Scan using Camera
              </button>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', border: '1px solid rgba(9, 167, 100, 0.3)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualEntry();
                }}
              >
                📝 Enter Values Manually
              </button>
            </div>
          </div>

          {/* Quick Demo Section */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={16} /> Fast Demo: Try with Sample Food Labels
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {SAMPLE_LABELS.map(sample => (
                <div 
                  key={sample.id}
                  onClick={() => handleLoadDemo(sample)}
                  style={{
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'var(--primary-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {sample.category}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.25rem' }}>{sample.name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {sample.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Pre-processes an image using HTML5 Canvas to increase contrast and convert to grayscale.
 * Helps improve OCR results on curved surfaces with shadows/reflections.
 */
function preprocessImageForOcr(imageFile: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageFile);
        return;
      }

      // Max dimension limit for OCR speed/accuracy
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Local Adaptive Thresholding (Niblack/Bernsen-style) to filter out glare and shadows
      const buffer = new Uint8ClampedArray(data.length);
      const d = 5; // neighborhood distance offset
      const margin = 18; // difference sensitivity threshold (lower is more sensitive)
      
      // Initialize output buffer to white background
      buffer.fill(255);
      for (let i = 3; i < buffer.length; i += 4) {
        buffer[i] = 255; // Keep alpha opaque
      }

      // First pass: Pre-compute grayscale values to avoid re-calculating Luma coefficients inside the loop
      const grayValues = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        grayValues[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Second pass: Slide neighborhood window and compute differences
      for (let y = d; y < height - d; y++) {
        for (let x = d; x < width - d; x++) {
          const centerIdx = y * width + x;
          const currentGray = grayValues[centerIdx];
          
          // Sample 4 cross-neighbors at distance d
          const topGray = grayValues[(y - d) * width + x];
          const botGray = grayValues[(y + d) * width + x];
          const leftGray = grayValues[y * width + (x - d)];
          const rightGray = grayValues[y * width + (x + d)];
          
          const localAvg = (topGray + botGray + leftGray + rightGray) / 4;
          
          // If current pixel is darker than local average by 'margin', mark it black (text). Otherwise white (background)
          const binarized = currentGray < (localAvg - margin) ? 0 : 255;
          
          const destIdx = centerIdx * 4;
          buffer[destIdx] = binarized;
          buffer[destIdx + 1] = binarized;
          buffer[destIdx + 2] = binarized;
        }
      }

      // Copy binarized buffer back to image data array
      for (let i = 0; i < data.length; i++) {
        data[i] = buffer[i];
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        resolve(blob || imageFile);
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => {
      resolve(imageFile);
    };
  });
}

