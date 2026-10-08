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
