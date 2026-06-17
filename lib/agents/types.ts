export type AgentName =
  | 'generalResearch'
  | 'listingCreator'
  | 'matchFinder'
  | 'messageDrafter'
  | 'reputationCoach'
  | 'articleDrafter'
  | 'eventPromoter'
  | 'applicationWriter'
  | 'salesDevelopment'
  | 'trustScoreOptimiser'
  | 'bulkListingGenerator'
  | 'imageGenerator'
  | 'revenueIntelligence'
  | 'pricingAdviser'
  | 'collabMatchmaker'
  | 'contentRepurposer';

export interface AgentConfig {
  name: AgentName;
  displayName: string;
  icon: string;
  creditCost: number;
  oneLineDescription: string;
  useCase: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  responseFormat?: 'json' | 'text';
  webSearch?: boolean;
  /** When true, the UI hits /api/agents/stream and renders output as it arrives.
   *  Use for agents with large outputs (e.g. Bulk Listing Generator) that risk
   *  hitting Vercel's 60-second response timeout. */
  streaming?: boolean;
}

export interface AgentRunResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  creditsCharged: number;
  agentName: AgentName;
}
