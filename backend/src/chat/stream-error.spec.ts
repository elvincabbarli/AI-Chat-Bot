import { describe, expect, it } from 'vitest';
import { streamErrorMessage } from './stream-error.js';

describe('Stream error messages', () => {
  it('explains model and quota failures', () => {
    expect(streamErrorMessage({ status: 404 })).toContain('GEMINI_MODEL');
    expect(streamErrorMessage({ status: 429 })).toContain('limit');
    expect(streamErrorMessage({ status: 503 })).toContain('overloaded');
  });
  it('does not expose provider messages or keys', () => {
    expect(streamErrorMessage({ message: 'secret API key' })).not.toContain(
      'secret',
    );
    expect(streamErrorMessage(null)).toContain('did not return a response');
  });
  it('distinguishes database writes from AI generation failures', () => {
    expect(
      streamErrorMessage(new Error('database connection'), true),
    ).toContain('could not be saved to history');
  });
});
