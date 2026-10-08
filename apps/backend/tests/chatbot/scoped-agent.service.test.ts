jest.mock('../../src/modules/chatbot/scope-guard.service', () => ({ isMessageInScope: jest.fn() }));
jest.mock('../../src/modules/chatbot/slm-client', () => ({
  chatWithLocalModel: jest.fn(),
  SAFE_AGENT_REPLY: 'safe reply',
}));

import { isMessageInScope } from '../../src/modules/chatbot/scope-guard.service';
import { chatWithLocalModel } from '../../src/modules/chatbot/slm-client';
import { runScopedAgentLoop } from '../../src/modules/chatbot/scoped-agent.service';

const scopeMock = jest.mocked(isMessageInScope);
const chatMock = jest.mocked(chatWithLocalModel);

describe('runScopedAgentLoop', () => {
  beforeEach(() => {
    scopeMock.mockReset();
    chatMock.mockReset();
  });

  it.each([['en', 'English refusal'], ['ur', 'اردو انکار']] as const)(
    'returns the %s refusal before entering the agent loop', async (locale, refusal) => {
      scopeMock.mockResolvedValue(false);
      const result = await runScopedAgentLoop({
        systemPrompt: 'assistant', tools: [], history: [], userMessage: 'off-topic', toolExecutor: jest.fn(),
      }, {
        exemplarQuestions: ['store product question'],
        refusalMessage: { en: 'English refusal', ur: 'اردو انکار' },
        similarityThreshold: 0.5,
      }, locale);
      expect(result).toEqual({ finalReply: refusal, steps: [] });
      expect(chatMock).not.toHaveBeenCalled();
    },
  );
});
