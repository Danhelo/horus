/**
 * Simple tokenizer utility for streaming UX
 *
 * For production with precise token counts, consider using tiktoken.
 * This implementation is sufficient for creating realistic streaming effects.
 */

/**
 * Tokenize text into chunks for streaming
 * Preserves whitespace and punctuation as separate tokens
 */
export function tokenize(text: string): string[] {
  // Match words, whitespace, and punctuation as separate tokens
  // This creates natural-feeling streaming chunks
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Estimate token count (rough approximation)
 * For accurate counts, use tiktoken
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token on average for English
  return Math.ceil(text.length / 4);
}

/**
 * Sleep utility for simulating streaming delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get random delay for natural-feeling streaming
 * @param baseMs Base delay in milliseconds
 * @param jitterMs Random jitter to add (0 to jitterMs)
 */
export function getStreamingDelay(baseMs: number = 50, jitterMs: number = 50): number {
  return baseMs + Math.random() * jitterMs;
}
