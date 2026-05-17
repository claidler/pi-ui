/**
 * Hermes Agent Connection Service
 * 
 * Handles communication with the Hermes coding agent via its OpenAI-compatible API.
 */

const HERMES_BASE_URL = 'http://localhost:8642/v1';

export interface HermesMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
}

export interface ChatCompletionRequest {
  model?: string;
  messages: HermesMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: HermesMessage;
    finish_reason: string;
  }>;
}

export async function sendMessageToHermes(
  messages: HermesMessage[],
  options: Partial<ChatCompletionRequest> = {}
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${HERMES_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'hermes',
      messages,
      stream: false,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function* streamMessageFromHermes(
  messages: HermesMessage[],
  options: Partial<ChatCompletionRequest> = {}
) {
  const response = await fetch(`${HERMES_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'hermes',
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hermes streaming error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          yield parsed;
        } catch (e) {
          console.warn('Failed to parse stream chunk:', data);
        }
      }
    }
  }
}
