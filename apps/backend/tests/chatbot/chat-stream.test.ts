import { chatWithLocalModelStream } from '../../src/modules/chatbot/slm-client';
import { runAgentLoop } from '../../src/modules/chatbot/agent-loop.service';
import { ReadableStream } from 'node:stream/web';

function sse(events: Array<{ type: string; [key: string]: unknown }>) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(controller) {
    for (const item of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
    controller.close();
  } }), { status: 200 });
}

describe('AI provider streaming bridge', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes genuine provider deltas and validates the final reply', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(sse([
      { type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' },
      { type: 'final', envelope: { reply: 'Hello' } },
    ]));
    const deltas: string[] = [];
    const result = await chatWithLocalModelStream([{ role: 'user', content: 'Hi' }], [], (part) => deltas.push(part));
    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ reply: 'Hello' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/internal/chat/stream'), expect.objectContaining({ method: 'POST' }));
  });

  it('does not execute an unauthorized tool from a malformed envelope', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(sse([
      { type: 'final', envelope: { tool_call: { type: 'unknown', payload: {} } } },
    ]));
    const execute = jest.fn();
    const result = await runAgentLoop({ systemPrompt: 'Safe', tools: [], history: [], userMessage: 'Hi',
      toolExecutor: execute, onDelta: jest.fn() });
    expect(execute).not.toHaveBeenCalled();
    expect(result.finalReply).toContain('safely process');
  });

  it('reports incomplete provider output without a completed assistant response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(sse([{ type: 'delta', text: 'Partial' }]));
    await expect(chatWithLocalModelStream([], [], jest.fn())).rejects.toThrow('Local AI service is unavailable');
  });

  it('passes cancellation to the provider request and stops the agent before a tool runs', async () => {
    const controller = new AbortController();
    const execute = jest.fn();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_url, options) => {
      expect(options?.signal).toBeDefined();
      controller.abort();
      throw new Error('Aborted');
    });
    await expect(runAgentLoop({ systemPrompt: 'Safe', tools: [], history: [], userMessage: 'Hi',
      toolExecutor: execute, onDelta: jest.fn(), signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});
