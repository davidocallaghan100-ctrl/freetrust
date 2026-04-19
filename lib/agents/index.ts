import type { AgentConfig, AgentName } from './types';
import { listingCreatorConfig } from './listingCreator';
import { matchFinderConfig } from './matchFinder';
import { messageDrafterConfig } from './messageDrafter';
import { reputationCoachConfig } from './reputationCoach';
import { articleDrafterConfig } from './articleDrafter';
import { eventPromoterConfig } from './eventPromoter';
import { applicationWriterConfig } from './applicationWriter';
import { salesDevelopmentConfig } from './salesDevelopment';
import { translatorConfig } from './translator';

export const AGENT_REGISTRY: Record<AgentName, AgentConfig> = {
  listingCreator: listingCreatorConfig,
  matchFinder: matchFinderConfig,
  messageDrafter: messageDrafterConfig,
  reputationCoach: reputationCoachConfig,
  articleDrafter: articleDrafterConfig,
  eventPromoter: eventPromoterConfig,
  applicationWriter: applicationWriterConfig,
  salesDevelopment: salesDevelopmentConfig,
  translator: translatorConfig,
};

export const AGENT_LIST: AgentConfig[] = Object.values(AGENT_REGISTRY);

export function getAgent(name: string): AgentConfig | null {
  if (name in AGENT_REGISTRY) {
    return AGENT_REGISTRY[name as AgentName];
  }
  return null;
}

export type { AgentName, AgentConfig, AgentRunResult } from './types';
