import axios from 'axios';

jest.mock('axios');

import { DependencyError } from '../../src/core/errors/AppError';
import { chatWithLocalModel, parseChatEnvelope, SAFE_AGENT_REPLY } from '../../src/modules/chatbot/slm-client';

const tools = [{ name: 'get_order_status', parameters: {} }];

describe('seller agent local model boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fails closed for malformed and non-allowlisted tool envelopes', () => {
    const allowed = new Set(tools.map((tool) => tool.name));
    expect(parseChatEnvelope({ tool_call: { type: 'delete_product', payload: {} } }, allowed)).toEqual({ reply: SAFE_AGENT_REPLY });
    expect(parseChatEnvelope({ tool_call: { type: 'get_order_status', payload: [], extra: true } }, allowed)).toEqual({ reply: SAFE_AGENT_REPLY });
    expect(parseChatEnvelope('{not json}', allowed)).toEqual({ reply: SAFE_AGENT_REPLY });
  });

  it('maps local model timeout or transport errors to a controlled dependency error', async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    await expect(chatWithLocalModel([{ role: 'user', content: 'sales' }], tools)).rejects.toMatchObject<Partial<DependencyError>>({
      statusCode: 503,
      code: 'LOCAL_AI_UNAVAILABLE',
      message: 'Local AI service is unavailable',
    });
  });

  it('returns the safe reply when the model response is malformed', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({ data: { reply: ['not', 'text'] } });
    await expect(chatWithLocalModel([{ role: 'user', content: 'sales' }], tools)).resolves.toEqual({ reply: SAFE_AGENT_REPLY });
  });
});
