jest.mock('axios');

import axios from 'axios';
import { clearScopeExemplarCacheForTests, isMessageInScope } from '../../src/modules/chatbot/scope-guard.service';

const axiosPost = jest.mocked(axios.post);

describe('scope guard similarity threshold', () => {
  beforeEach(() => {
    clearScopeExemplarCacheForTests();
    axiosPost.mockReset();
  });

  it('caches exemplar embeddings, accepts in-scope questions, and rejects unrelated questions', async () => {
    const inScope = ["do you have this in blue", "is this available in size XL", "what's the price of this product", "what variants are available", "how much quantity do you have"];
    const outOfScope = ["write a poem about space", "who won the election", "debug my computer", "tell me a joke", "what is the capital of France"];
    const vector = (index: number): number[] => {
      const values = Array(768).fill(0);
      values[index] = 1;
      return values;
    };
    axiosPost.mockImplementation(async (_url, body) => {
      const texts = (body as { texts: string[] }).texts;
      if (texts.length > 1) return { data: { embeddings: inScope.map((_, index) => vector(index)) } } as never;
      const index = inScope.indexOf(texts[0] ?? '');
      return { data: { embeddings: [vector(index >= 0 ? index : 100)] } } as never;
    });
    const scope = { exemplarQuestions: inScope, refusalMessage: { en: 'No', ur: 'نہیں' }, similarityThreshold: 0.5 };

    for (const question of inScope) await expect(isMessageInScope(question, scope)).resolves.toBe(true);
    for (const question of outOfScope) await expect(isMessageInScope(question, scope)).resolves.toBe(false);
    // One exemplar batch plus one message embedding for each of the ten inputs.
    expect(axiosPost).toHaveBeenCalledTimes(11);
  });
});
