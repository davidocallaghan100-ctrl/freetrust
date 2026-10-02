const CONNECTED_APP_INTENT_PATTERN = /\b(?:hubspot|salesforce|outlook|microsoft\s*365|whatsapp(?:\s+business)?|instagram(?:\s+business|\s+creator)?|linkedin(?:\s+profile)?|crm|connected\s+(?:app|account|tool)|my\s+(?:email|emails|mailbox|inbox|contacts?|leads?|deals?))\b/i

/**
 * Connected-app tools are intentionally opt-in for a single request. Offering
 * every connected tool to broad Research prompts makes the model more likely
 * to call an unrelated integration and adds unnecessary tool-loop latency.
 */
export function shouldUseConnectedAppTools(input: string) {
  return CONNECTED_APP_INTENT_PATTERN.test(input.trim())
}
