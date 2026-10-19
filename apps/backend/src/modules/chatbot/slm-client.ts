import axios from 'axios';

import { config } from '../../core/config';
import { DependencyError } from '../../core/errors/AppError';

export interface ChatToolDefinition {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  type: string;
  payload: Record<string, unknown>;
}

export type ChatEnvelope = { reply: string } | { tool_call: ToolCall };

export async function chatWithLocalModel(
  messages: Array<{ role: string; content: string }>,
  tools: ChatToolDefinition[],
): Promise<ChatEnvelope> {
  try {
    const response = await axios.post<unknown>(
      `${config.aiServiceUrl}/internal/chat`,
      { messages, tools },
      { timeout: 600_000 },
    );
    return parseChatEnvelope(response.data, new Set(tools.map((tool) => tool.name)));
  } catch (error) {
    if (error instanceof DependencyError) throw error;
    throw new DependencyError('Local AI service is unavailable', undefined, 'LOCAL_AI_UNAVAILABLE');
  }
}

export async function chatWithLocalModelStream(
  messages: Array<{ role: string; content: string }>,
  tools: ChatToolDefinition[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<ChatEnvelope> {
  try {
    const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(600_000)]) : AbortSignal.timeout(600_000);
    const response = await fetch(`${config.aiServiceUrl}/internal/chat/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, tools }), signal: boundedSignal,
    });
    if (!response.ok || !response.body) throw new Error('AI stream unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final: ChatEnvelope | undefined;
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      if (buffer.length > 128_000) throw new Error('AI stream event too large');
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const line = event.split('\n').find((part) => part.startsWith('data: '));
        if (!line) continue;
        const item = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (item.type === 'delta' && typeof item.text === 'string') onDelta(item.text);
        else if (item.type === 'final') final = parseChatEnvelope(item.envelope, new Set(tools.map((tool) => tool.name)));
        else if (item.type === 'error') throw new Error('AI stream failed');
      }
      if (done) break;
    }
    if (!final) throw new Error('AI stream ended without a final envelope');
    return final;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DependencyError('Local AI service is unavailable', undefined, 'LOCAL_AI_UNAVAILABLE');
  }
}

export function parseChatEnvelope(value: unknown, allowedTools: Set<string>): ChatEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { reply: SAFE_AGENT_REPLY };
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).length === 1 && typeof envelope.reply === 'string') {
    return { reply: envelope.reply };
  }
  const call = envelope.tool_call;
  if (
    Object.keys(envelope).length === 1 &&
    call && typeof call === 'object' && !Array.isArray(call) &&
    Object.keys(call).length === 2 &&
    typeof (call as Record<string, unknown>).type === 'string' &&
    allowedTools.has((call as Record<string, unknown>).type as string) &&
    (call as Record<string, unknown>).payload !== null &&
    typeof (call as Record<string, unknown>).payload === 'object' &&
    !Array.isArray((call as Record<string, unknown>).payload)
  ) {
    return { tool_call: call as ToolCall };
  }
  return { reply: SAFE_AGENT_REPLY };
}

export const SAFE_AGENT_REPLY = "I couldn't safely process that request. Please rephrase it.";
