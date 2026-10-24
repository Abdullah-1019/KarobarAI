import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

import '../../app/i18n';
import i18n from 'i18next';
import { ApiError } from '../../api';
import { ChatModeSelector } from './ChatModeSelector';
import { chatErrorMessage, useChatMode } from './chatMode';
import { streamChat } from './streamChat';

describe('ChatModeSelector', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows both modes with the selected one checked and its helper text', () => {
    render(<ChatModeSelector value="fast" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Fast Mode — Gemini AI/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Slow Mode — Local Ollama/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Fast Mode: Quick answers, product search and shopping actions.')).toBeInTheDocument();
  });

  it('reports a change and ignores a click on the current mode', () => {
    const onChange = vi.fn();
    render(<ChatModeSelector value="fast" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Fast Mode/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Slow Mode/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('slow');
  });

  it('is locked while a request is in flight', () => {
    const onChange = vi.fn();
    render(<ChatModeSelector value="fast" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('radio', { name: /Slow Mode/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('defaults to Fast Mode and remembers the choice per chat', () => {
    const { result } = renderHook(() => useChatMode('karobar-ai-mode:test'));
    expect(result.current[0]).toBe('fast');
    act(() => result.current[1]('slow'));
    expect(result.current[0]).toBe('slow');
    expect(renderHook(() => useChatMode('karobar-ai-mode:test')).result.current[0]).toBe('slow');
    expect(renderHook(() => useChatMode('karobar-ai-mode:other')).result.current[0]).toBe('fast');
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem('karobar-ai-mode:test', 'gemini-pro');
    expect(renderHook(() => useChatMode('karobar-ai-mode:test')).result.current[0]).toBe('fast');
  });

  it('maps provider failures to actionable messages', () => {
    const t = i18n.getFixedT('en');
    expect(chatErrorMessage(new ApiError('FAST_MODE_NOT_CONFIGURED', 'x'), t)).toContain('Switch to Slow Mode');
    expect(chatErrorMessage(new ApiError('LOCAL_AI_UNAVAILABLE', 'x'), t)).toContain('Ollama');
    expect(chatErrorMessage(new Error('boom'), t)).toBeNull();
  });

  it('carries the server error code from a failed stream', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: error\ndata: {"code":"FAST_MODE_NOT_CONFIGURED"}\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await expect(streamChat('/stores/x/chat/stream', {}, vi.fn(), new AbortController().signal))
      .rejects.toMatchObject({ code: 'FAST_MODE_NOT_CONFIGURED' });
  });

  it('carries the API error code when the stream is refused before it starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { code: 'BUYER_CHAT_RATE_LIMIT', message: 'slow down' } }), { status: 429, headers: { 'Content-Type': 'application/json' } })));
    await expect(streamChat('/stores/x/chat/stream', {}, vi.fn(), new AbortController().signal))
      .rejects.toMatchObject({ code: 'BUYER_CHAT_RATE_LIMIT' });
  });
});
