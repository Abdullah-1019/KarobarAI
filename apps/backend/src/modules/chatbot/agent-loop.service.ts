import { logger } from '../../core/logger';
import { chatWithLocalModel, SAFE_AGENT_REPLY, type ChatToolDefinition, type ToolCall } from './slm-client';

export interface AgentHistoryMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  toolCall?: unknown;
  toolResult?: unknown;
}

export interface AgentLoopParams {
  systemPrompt: string;
  tools: ChatToolDefinition[];
  history: AgentHistoryMessage[];
  userMessage: string;
  toolExecutor: (toolCall: ToolCall) => Promise<unknown>;
  maxSteps?: number;
}

export interface AgentLoopResult {
  finalReply: string;
  steps: Array<{ toolCall: ToolCall; toolResult: unknown }>;
}

export async function runAgentLoop(params: AgentLoopParams): Promise<AgentLoopResult> {
  const maxSteps = Number.isInteger(params.maxSteps) && (params.maxSteps ?? 0) > 0 ? params.maxSteps! : 4;
  const history = params.history.map((message) => ({
    role: message.role.toLowerCase(),
    content: message.content,
  }));
  const messages = [
    { role: 'system', content: params.systemPrompt },
    ...history,
    { role: 'user', content: params.userMessage },
  ];
  const steps: AgentLoopResult['steps'] = [];

  for (let index = 0; index < maxSteps; index += 1) {
    const response = await chatWithLocalModel(messages, params.tools);
    if ('reply' in response) return { finalReply: response.reply, steps };

    const toolCall = response.tool_call;
    const toolResult = await params.toolExecutor(toolCall);
    steps.push({ toolCall, toolResult });
    logger.debug({ step: index + 1, toolType: toolCall.type }, 'agent tool call completed');
    messages.push({ role: 'assistant', content: JSON.stringify({ tool_call: toolCall }) });
    messages.push({ role: 'tool', content: JSON.stringify(toolResult) });
  }

  logger.warn({ maxSteps, completedSteps: steps.length }, 'agent loop reached max step limit');
  return { finalReply: "I wasn't able to complete that — could you rephrase?", steps };
}
