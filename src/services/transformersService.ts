// WebGPU Browser-based LLM Service using Transformers.js (v3/v4)
import { env, pipeline } from '@huggingface/transformers';

// Configure environment to allow browser caching
env.allowLocalModels = false;

let textGenPipeline: any = null;
let currentModelName = 'onnx-community/gemma-2-2b-it-ONNX'; // or another smaller model e.g. Qwen1.5-1.8B-Chat

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export interface ModelLoadProgress {
  status: 'initiating' | 'downloading' | 'done' | 'error';
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  message?: string;
}

/**
 * Initializes and loads the ONNX model in the browser using WebGPU
 */
export async function loadWebGpuModel(
  onProgress: (progress: ModelLoadProgress) => void,
  modelName: string = currentModelName
): Promise<any> {
  if (!isWebGpuSupported()) {
    throw new Error("WebGPU is not supported by your browser or graphics card.");
  }

  if (textGenPipeline) {
    onProgress({ status: 'done', message: 'Model already loaded.' });
    return textGenPipeline;
  }

  onProgress({ status: 'initiating', message: 'Initializing WebGPU context and downloading model metadata...' });

  try {
    textGenPipeline = await pipeline('text-generation', modelName, {
      device: 'webgpu',
      dtype: 'q4', // 4-bit quantization for browser-friendly memory consumption
      progress_callback: (data: any) => {
        if (data.status === 'downloading') {
          onProgress({
            status: 'downloading',
            file: data.file,
            progress: data.progress,
            loaded: data.loaded,
            total: data.total,
            message: `Downloading weights: ${data.file} (${Math.round(data.progress)}%)`
          });
        } else if (data.status === 'done') {
          onProgress({
            status: 'initiating',
            message: `Loading model files into GPU memory...`
          });
        }
      }
    });

    onProgress({ status: 'done', message: 'Model loaded successfully!' });
    return textGenPipeline;
  } catch (err: any) {
    onProgress({ status: 'error', message: `Failed to load model: ${err.message || err}` });
    throw err;
  }
}

/**
 * Generates text using the WebGPU model loaded in-browser
 */
export async function generateWebGpuResponse(
  systemPrompt: string,
  userPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  if (!textGenPipeline) {
    throw new Error("Model is not loaded. Call loadWebGpuModel first.");
  }

  // Format the prompt for Gemma (using its Chat template)
  const prompt = `<start_of_turn>user
System: ${systemPrompt}

User question: ${userPrompt}<end_of_turn>
<start_of_turn>model
`;

  onChunk("AI loading (WebGPU processing)...");

  try {
    const outputs = await textGenPipeline(prompt, {
      max_new_tokens: 300,
      do_sample: true,
      temperature: 0.3,
      top_k: 50,
      top_p: 0.9,
    });

    const generatedText = outputs[0].generated_text;
    
    // Extract the response after the <start_of_turn>model tag
    const marker = "<start_of_turn>model\n";
    const markerIndex = generatedText.lastIndexOf(marker);
    let cleanResponse = generatedText;
    
    if (markerIndex !== -1) {
      cleanResponse = generatedText.slice(markerIndex + marker.length).trim();
    } else {
      // fallback cleanup if template differs
      cleanResponse = generatedText.replace(prompt, '').trim();
    }

    onChunk(cleanResponse);
    return cleanResponse;
  } catch (err: any) {
    console.error("WebGPU generation error:", err);
    throw new Error(`Generation failed: ${err.message || err}`);
  }
}
