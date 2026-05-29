# System Architecture Specification: Label Padhega India

This document defines the high-level architecture, processing pipelines, mathematical models, and network topology for **Label Padhega India** (FSSAI Food Label Auditor).

---

## 1. System Overview & Component Block Diagram

Label Padhega India is a client-side Progressive Web Application (PWA) designed to audit food labels, flags false claims, and analyze nutritional safety against FSSAI guidelines.

```mermaid
graph TB
    subgraph Client Browser [Client-Side Sandbox (PWA)]
        UI[React View Shell: App.tsx]
        
        subgraph Scanning Module
            Camera[Webcam / Upload Stream] --> Canvas[HTML5 Canvas Processor]
            Canvas --> LocalOCR[Local OCR: Tesseract.js]
            LocalOCR --> RawText[Raw Text String]
        end
        
        subgraph Audit Engine [Deterministic TypeScript Engine]
            RawText --> RegParser[Regex Extractor & Normalizer]
            RegParser --> NutData[Structured NutritionalData JSON]
            RegParser --> IngText[Ingredients Text List]
            
            NutData --> CalEng[Calorie Engine: Math Verification]
            NutData --> ClaimEng[Claims Auditor: FSSAI Thresholds]
            NutData --> RDAEng[RDA Tracker: Daily Allowance Percentage]
            IngText --> IngParser[Ingredients Parser: Additives, Sugars & Allergens]
        end
        
        subgraph UI Dashboard [Interactive Audit View]
            CalEng --> Dash[Interactive Dashboard Panels]
            ClaimEng --> Dash
            RDAEng --> Dash
            IngParser --> Dash
            Dash --> UserEdit[Inline Manual Corrections Editor]
            UserEdit --> AuditEngine
        end
        
        subgraph Local LLM Reasoning Module
            Chat[Chat Sidebar: ChatAuditor.tsx]
            DashSummary[Context Builder] --> Chat
            WebGPU[Transformers.js WebGPU: Gemma-2B] ===|Offline Chat| Chat
        end
    end

    subgraph Host Machine [macOS Desktop Host]
        Ollama[Ollama Instance: gemma2:2b / 9b]
    end

    subgraph Cloud Layer [Optional Cloud Services]
        Gemini[Google Gemini 2.5 Flash API]
    end

    %% Network Connections
    Chat ===|Relative Proxy /ollama-api| ViteProxy[Vite Dev Server HTTPS Proxy]
    ViteProxy ===|HTTP Loopback 127.0.0.1:11434| Ollama
    Chat ===|Client HTTPS Fetch with API Key| Gemini
    Canvas ===|Gemini Vision OCR| Gemini
```

---

## 2. Image Pre-Processing & OCR Pipeline

Real-world label photos on cylindrical bottles are prone to glare, dark shadows, and line warping. The app uses an optimized image pipeline to maximize text capture rate before running OCR.

### 2.1 Grayscale Binarization & Adaptive Thresholding
A standard global contrast threshold turns shadow zones black and glare zones white, erasing text. We use a **Bernsen-style Local Adaptive Thresholding Filter** inside [CameraScanner.tsx](src/components/CameraScanner.tsx):

1. **Grayscale Reduction**: Color pixels are flattened using Luma coefficients:
   $$Y = 0.299R + 0.587G + 0.114B$$
2. **Pre-Computed Arrays**: Grayscale values are mapped into a single dimension `grayValues` array to reduce indexing multiplication overhead.
3. **Neighborhood Sliding Window**: For each pixel $(x, y)$, a cross-shaped neighborhood of distance $d = 5$ pixels is checked (Top, Bottom, Left, Right).
4. **Local Thresholding**: The pixel's intensity is compared against the local neighborhood average:
   $$\text{Threshold} = \mu_{\text{local}} - \text{margin}$$
   * If the pixel is darker than the threshold, it becomes **black ($0$)**.
   * Otherwise, it becomes **white ($255$)**.
   This process extracts high-frequency text boundaries while completely ignoring low-frequency lighting gradients, shadows, and reflections.

---

## 3. Deterministic Parsing & Regex Extraction

Tesseract extracts unstructured text lines. To populate input fields automatically, [ocrService.ts](src/engine/ocrService.ts) runs a distance-tolerant lookahead regex crawler:

### 3.1 OCR Cleanup
Digit spacing errors are normalized:
- `12 , 3` or `12,3` $\rightarrow$ `12.3`
- `12 . 3` $\rightarrow$ `12.3`

### 3.2 Key-Value Extraction Formula
For each nutrient keyword (e.g., `protein`, `saturated fat`), the parser runs a regular expression that matches the keyword, skips up to 35 characters of non-digit symbols (units in parentheses like `(g)` or `(kcal)`), and extracts the first floating-point number:
```regex
\b{keyword}\b[^0-9\n]{0,35}(\d+(?:\.\d+)?|\.\d+)
```

---

## 4. Mathematical Audit Engines

Once numbers are extracted, they are routed to deterministic rule engines in the browser:

### 4.1 Calorie Mismatch Calculation
[calorieEngine.ts](src/engine/calorieEngine.ts) verifies energy declarations using FSSAI standard conversion factors:
$$\text{Calculated Energy} = (\text{Carbs} \times 4) + (\text{Protein} \times 4) + (\text{Fat} \times 9) + (\text{Fiber} \times 2)$$
- **Tolerance**: FSSAI permits a $\pm 20\%$ deviation. Mismatches exceeding this threshold are flagged as **Critical Underreporting** (attempts to make products look less caloric) or **Overreporting** (indicating labelling errors).

### 4.2 FSSAI Claims Auditor
[fssaiRules.ts](src/engine/fssaiRules.ts) compares declared values per 100g/ml against legal thresholds from the FSS (Advertising and Claims) Regulations 2018:
- **Sugar-Free**: $\le 0.5\text{g} / 100\text{g}$
- **Low Sugar**: $\le 5\text{g} / 100\text{g}$ (solids) or $\le 2.5\text{g} / 100\text{ml}$ (liquids)
- **Low Fat**: $\le 3\text{g} / 100\text{g}$ (solids) or $\le 1.5\text{g} / 100\text{ml}$ (liquids)
- **High Protein**: $\ge 20\%$ RDA ($10.8\text{g}$ protein per $100\text{g}$ solids)

---

## 5. Network Topology & Mobile Secure Contexts

Mobile browsers require a **Secure Context (HTTPS)** to access cameras via WebRTC APIs (`navigator.mediaDevices.getUserMedia`). 

```text
[Mobile Client (HTTPS)] ──► (Port 5173 / HTTPS) [Vite Web Server]
                                                    │
                                                    ▼ (Vite Reverse Proxy)
[Ollama API (HTTP)]     ◄── (Port 11434 / HTTP) ────┘
```

1. **Vite dev server** runs over HTTPS using self-signed keys generated by `@vitejs/plugin-basic-ssl`.
2. **Mixed Content Bypass**: An HTTPS page cannot fetch from insecure HTTP addresses (`http://192.168.0.76:11434`) due to browser security models. We resolve this by creating a proxy mapping `/ollama-api` inside [vite.config.ts](vite.config.ts).
3. The mobile client queries `https://192.168.0.76:5173/ollama-api/api/chat`. The Vite server accepts this securely, proxies the request to the local HTTP endpoint `http://localhost:11434/api/chat` on the Mac, and streams the response back.
4. **CORS Configuration**: The Ollama instance is launched in the macOS shell setting `OLLAMA_ORIGINS="*"` and `OLLAMA_HOST="0.0.0.0"` to accept proxied local network headers.
