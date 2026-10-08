jest.mock('../../src/modules/chatbot/slm-client', () => ({
  chatWithLocalModel: jest.fn(),
  SAFE_AGENT_REPLY: 'safe reply',
}));

import { chatWithLocalModel } from '../../src/modules/chatbot/slm-client';
import { runAgentLoop } from '../../src/modules/chatbot/agent-loop.service';

const chatMock = jest.mocked(chatWithLocalModel);

describe('runAgentLoop', () => {
  beforeEach(() => chatMock.mockReset());

  it('chains two sequential tool calls before returning the final reply', async () => {
    chatMock
      .mockResolvedValueOnce({ tool_call: { type: 'search_products', payload: { query: 'shirt' } } })
      .mockResolvedValueOnce({ tool_call: { type: 'get_product', payload: { productId: 'p1' } } })
      .mockResolvedValueOnce({ reply: 'The shirt costs Rs 1200.' });
    const toolExecutor = jest.fn()
      .mockResolvedValueOnce({ ids: ['p1'] })
      .mockResolvedValueOnce({ price: '1200.00' });

    const result = await runAgentLoop({
      systemPrompt: 'Ground answers in tool results.',
      tools: [{ name: 'search_products', parameters: {} }, { name: 'get_product', parameters: {} }],
      history: [],
      userMessage: 'Find a shirt and tell me the price.',
      toolExecutor,
    });

    expect(result.finalReply).toBe('The shirt costs Rs 1200.');
    expect(result.steps).toHaveLength(2);
    expect(toolExecutor).toHaveBeenCalledTimes(2);
    expect(chatMock).toHaveBeenCalledTimes(3);
  });

  it('returns immediately when the model responds without a tool call', async () => {
    chatMock.mockResolvedValueOnce({ reply: 'Hello.' });
    const toolExecutor = jest.fn();
    const result = await runAgentLoop({
      systemPrompt: 'Store assistant.', tools: [], history: [], userMessage: 'Hi', toolExecutor,
    });
    expect(result).toEqual({ finalReply: 'Hello.', steps: [] });
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(toolExecutor).not.toHaveBeenCalled();
  });

  it('enforces the configured max step count and does not make an extra model call', async () => {
    chatMock.mockResolvedValue({ tool_call: { type: 'search_products', payload: {} } });
    const result = await runAgentLoop({
      systemPrompt: 'Store assistant.',
      tools: [{ name: 'search_products', parameters: {} }],
      history: [], userMessage: 'Find something', toolExecutor: async () => ({}), maxSteps: 2,
    });
    expect(result.finalReply).toContain('could you rephrase');
    expect(result.steps).toHaveLength(2);
    expect(chatMock).toHaveBeenCalledTimes(2);
  });
});
