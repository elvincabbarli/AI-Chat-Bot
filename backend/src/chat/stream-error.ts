export function streamErrorMessage(
  error: unknown,
  savingStarted = false,
): string {
  if (savingStarted)
    return 'The response was generated, but it could not be saved to history. Please try again.';
  const status = (error as { status?: number } | null)?.status;
  if (status === 404)
    return 'The AI model was not found. Check the GEMINI_MODEL setting in the backend.';
  if (status === 401 || status === 403)
    return 'Could not access the AI service. Check the API key and permissions in the backend.';
  if (status === 429)
    return 'The AI request limit has been reached. Please try again later and check your account limits.';
  if (status === 503)
    return 'The AI service is currently overloaded. Please try again later.';
  if (status === 400)
    return 'The AI service rejected the request. Try a shorter message in a new conversation.';
  return 'The AI service did not return a response. Please try again later.';
}
