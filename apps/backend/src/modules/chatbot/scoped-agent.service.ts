import type { ScopeGuardConfig } from './scope-guard.service';
import { isMessageInScope } from './scope-guard.service';
import { runAgentLoop, type AgentLoopParams, type AgentLoopResult } from './agent-loop.service';

export async function runScopedAgentLoop(
  params: AgentLoopParams,
  scope: ScopeGuardConfig,
  locale: 'en' | 'ur',
): Promise<AgentLoopResult> {
  // Scope is checked before any generation/tool execution so an unrelated request never enters
  // the full agent loop. The caller owns the bilingual canned refusal.
  if (!(await isMessageInScope(params.userMessage, scope))) {
    return { finalReply: scope.refusalMessage[locale], steps: [] };
  }
  return runAgentLoop(params);
}
