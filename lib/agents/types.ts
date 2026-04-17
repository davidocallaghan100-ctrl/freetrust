export type AgentName =
  | 'listingCreator'
  | 'matchFinder'
  | 'messageDrafter'
  | 'reputationCoach'
  | 'articleDrafter'
  | 'eventPromoter'
  | 'applicationWriter'
  | 'salesDevelopment'
  | 'translator';

export interface AgentConfig {
  name: AgentName;
  displayName: string;
  icon: string;
  creditCost: number;
  oneLineDescription: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
}

export interface AgentRunResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  creditsCharged: number;
  agentName: AgentName;
}
