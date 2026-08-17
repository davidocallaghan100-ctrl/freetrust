// Tiny client-side pub/sub bridging the TrustAssistant chat widget and the
// desktop-only GodAvatarPanel companion. Kept intentionally minimal — a single
// CustomEvent on window — so TrustAssistant's core chat logic does not need a
// context provider or any state-management refactor.

export const TRUST_ASSISTANT_EVENT = 'freetrust:trust-assistant-state'

export interface TrustAssistantStateDetail {
  open: boolean
  // Present when a new assistant reply was just appended to the chat.
  // `messageId` changes on every new reply so listeners can detect "new" vs
  // "same" message even if the text content is identical.
  assistantMessageId?: string
  assistantText?: string
}

export function emitTrustAssistantState(detail: TrustAssistantStateDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<TrustAssistantStateDetail>(TRUST_ASSISTANT_EVENT, { detail }))
}

export function subscribeTrustAssistantState(handler: (detail: TrustAssistantStateDetail) => void) {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => handler((e as CustomEvent<TrustAssistantStateDetail>).detail)
  window.addEventListener(TRUST_ASSISTANT_EVENT, listener)
  return () => window.removeEventListener(TRUST_ASSISTANT_EVENT, listener)
}
