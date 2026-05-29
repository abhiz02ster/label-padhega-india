export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'gemma2:2b'; // Default to a lightweight, fast model for Macs

/**
 * Checks if Ollama is running locally
 */
export async function testOllamaConnection(url: string = DEFAULT_OLLAMA_URL): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors'
    });
    return res.ok;
  } catch (e) {
    console.warn('Ollama connection test failed:', e);
    return false;
  }
}

/**
 * Retrieves list of locally installed models from Ollama
 */
export async function getOllamaModels(url: string = DEFAULT_OLLAMA_URL): Promise<string[]> {
  try {
    const res = await fetch(`${url}/api/tags`, { mode: 'cors' });
    if (!res.ok) return [DEFAULT_MODEL];
    const data = await res.json();
    return data.models?.map((m: any) => m.name) || [DEFAULT_MODEL];
  } catch (e) {
    return [DEFAULT_MODEL];
  }
}

/**
 * Sends a chat query to Ollama and streams the response back
 */
export async function streamOllamaChat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: {
    url?: string;
    model?: string;
  }
): Promise<void> {
  const baseUrl = options?.url || DEFAULT_OLLAMA_URL;
  const modelName = options?.model || DEFAULT_MODEL;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      stream: true,
      options: {
        temperature: 0.2, // low temp for factual audit responses
      }
    }),
    mode: 'cors'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Unable to read streaming body from Ollama.");
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Keep the last partial line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          onChunk(json.message.content);
        }
      } catch (err) {
        console.warn("Failed to parse Ollama stream line JSON:", line, err);
      }
    }
  }
}

/**
 * Builds the system prompt using FSSAI regulations context
 */
export function buildFssaiSystemPrompt(auditSummary: string, ingredientsList: string): string {
  return `
You are "Label Padhega India AI Bot" — an expert food safety auditor and advisor specialized in FSSAI (Food Safety and Standards Authority of India) food labeling rules.

Your mission is to help Indian consumers understand what they are eating, expose manufacturer marketing tricks (greenwashing), and verify if nutritional claims are scientifically and legally sound.

Here is the audited data for the product being examined:
--------------------------------------------------
${auditSummary}

Raw Ingredients: ${ingredientsList}
--------------------------------------------------

Guidelines for your response:
1. **Explain the Science**: If there is a calorie discrepancy or high hazard score, explain *why* this matters. Tell the user exactly what ingredients (like palm oil, maltodextrin, specific preservatives) are causing issues.
2. **Expose Marketing Tricks**: If the package says "Sugar-Free" but contains Maltodextrin or Invert Syrup, explain that Maltodextrin has a higher Glycemic Index than normal sugar and still spikes insulin.
3. **Be Specific to Health Conditions**: If the user asks about diabetes, high blood pressure, or giving this to children, cross-reference the sodium, sugar, trans fats, and additives to give a clear verdict.
4. **Factual & Objective Tone**: Avoid dramatic claims; base your arguments on FSSAI guidelines, WHO recommendations, and nutritional science.
5. **Concise but Thorough**: Write structured, easy-to-read markdown responses with bullet points.
6. **Polite Disclosure**: Add a brief disclaimer when talking about medical conditions that this is for educational purposes.
`;
}
