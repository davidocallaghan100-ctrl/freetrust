'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AGENT_LIST, type AgentConfig } from '@/lib/agents';

const COLORS = {
  bgBase: '#0f172a',
  card: '#1e293b',
  cardSoft: 'rgba(30,41,59,0.72)',
  border: 'rgba(56,189,248,0.12)',
  borderStrong: 'rgba(56,189,248,0.4)',
  borderMuted: 'rgba(148,163,184,0.16)',
  sky: '#38bdf8',
  skyHover: '#7dd3fc',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  radius: 16,
};

type AgentActionKind =
  | 'create_service'
  | 'create_product'
  | 'publish_article'
  | 'create_event'
  | 'create_feed_post'
  | 'prepare_message'
  | 'prepare_social_post';

type AgentAction = {
  id: string;
  kind: AgentActionKind;
  label: string;
  helper: string;
  payload: Record<string, unknown>;
};

type AgentAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: 'image' | 'text' | 'file';
  dataUrl?: string;
  content?: string;
  note?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AgentAttachment[];
  actions?: AgentAction[];
  raw?: unknown;
};

type SavedConversation = {
  id: string;
  title: string;
  agentName: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const MAX_ATTACHMENTS = 5;
const CONVERSATION_HISTORY_KEY = 'freetrust.agents.conversations.v1';
const MAX_SAVED_CONVERSATIONS = 8;
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const MAX_TEXT_BYTES = 120 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);

const AGENT_INPUT_GUIDANCE: Record<string, { placeholder: string; example: string }> = {
  generalResearch: {
    placeholder: 'Ask FreeTrust to research, analyse, plan, or improve something...',
    example: 'I am the founder of FreeTrust. What should I do to improve the platform? Research best practices and give me a prioritized plan.',
  },
  listingCreator: {
    placeholder: 'Tell it what you want to sell. Attach product photos, screenshots, or notes...',
    example: 'Create a service listing for 1-hour Spanish conversation practice for professionals relocating to Spain. €35/hr, online, friendly and practical.',
  },
  matchFinder: {
    placeholder: 'Describe who you want to find. Attach a listing, brief, or screenshot...',
    example: 'Find likely buyers or collaborators for a €500 pitch deck design service aimed at startup founders.',
  },
  messageDrafter: {
    placeholder: 'For a direct message, tell me who it is for, the context, tone, and outcome you want...',
    example: 'Direct message to a buyer who asked for a discount on my €80 logo design. Goal: counter with €70 and 24h delivery. Tone: warm but firm.',
  },
  reputationCoach: {
    placeholder: 'Describe your current activity and goal, or attach profile/listing screenshots...',
    example: 'Balance: ₮450. 3 listings, 0 sales so far. Goal: first sale this month. I freelance in web design.',
  },
  articleDrafter: {
    placeholder: 'Give the topic, outline, audience, and any source notes/files...',
    example: 'Write an article about how solo founders can use AI agents. Audience: other solo founders. Tone: practical, not hype.',
  },
  eventPromoter: {
    placeholder: 'Event title, date, location, audience, and notes. Attach poster/photo if useful...',
    example: 'Cork Community Swap Meet · Sat 15 June 10am-2pm · Triskel Arts Centre · Locals who like sustainable living.',
  },
  applicationWriter: {
    placeholder: 'Paste the job listing and your experience. Attach CV/portfolio notes...',
    example: 'Job: React developer, €3k budget, 2 weeks. Me: 4 years Next.js, built 3 marketplaces, available immediately.',
  },
  salesDevelopment: {
    placeholder: 'Ask for ICP, cold email, LinkedIn message, discovery questions, or objection response...',
    example: 'Task: cold_email. My offer: Spanish lessons for execs. Prospect: Maria, COO at a Cork SaaS startup.',
  },
  trustScoreOptimiser: {
    placeholder: 'Ask what to improve, or attach your profile/listing screenshots...',
    example: 'I want more profile views and my first 3 reviews this month. Tell me what to do first.',
  },
  bulkListingGenerator: {
    placeholder: 'Paste a list of products/services, or attach a text/CSV list...',
    example: 'Beginner Spanish lessons — €35/hr\nWebsite audit for small businesses — €120\nHandmade ceramic mugs — €28 each',
  },
  revenueIntelligence: {
    placeholder: 'Summarise sales history, listings, prices, and goals. Attach CSV/notes if useful...',
    example: 'I sell website audits (€120) and landing pages (€750). 3 audits sold, no landing pages yet. Goal: €2k/month.',
  },
  pricingAdviser: {
    placeholder: 'Describe the offer, current price, buyer, and competitors...',
    example: 'Service: 90-minute brand strategy session. Current price €95. I have 6 years experience. Buyers: solo founders.',
  },
  collabMatchmaker: {
    placeholder: 'Describe what you do and who you want as collaborators...',
    example: 'I design websites for local cafés. I want referral partners or bundled offers with photographers and copywriters.',
  },
  contentRepurposer: {
    placeholder: 'Tell me the platform, audience, announcement/topic, tone, and CTA for the post...',
    example: 'Write a LinkedIn post announcing FreeTrust Agent. Audience: founders, freelancers, and builders. Tone: confident, human, not corporate. CTA: ask people to try it or DM me for access.',
  },
  imageGenerator: {
    placeholder: 'Describe the safe original image you want FreeTrust to generate...',
    example: 'Generate a square social image for FreeTrust Agents: glowing blue trust network, Irish community marketplace, premium dark background, no people, no logos, no text.',
  },
};

const SALES_DEV_TASKS: { key: string; label: string; template: string }[] = [
  { key: 'icp', label: 'ICP', template: 'task: icp\n\nmy offer: [describe what you sell]\n\ncontext: [market, buyers, goals]' },
  { key: 'cold_email', label: 'Cold email', template: 'task: cold_email\n\nmy offer: [one-line offer]\n\nprospect: [name, role, company]\n\nwhy them: [specific reason]' },
  { key: 'linkedin_message', label: 'LinkedIn', template: 'task: linkedin_message\n\nmy offer: [one-line offer]\n\nprospect: [name, role, company, relevant detail]\n\ngoal: [connection / follow-up / intro]' },
  { key: 'discovery_questions', label: 'Discovery', template: 'task: discovery_questions\n\nmy offer: [what you sell]\n\nprospect: [name, role, company]\n\ncall context: [first call / follow-up / demo]' },
  { key: 'objection_response', label: 'Objection', template: 'task: objection_response\n\nmy offer: [what you sell]\n\nobjection received: [exact objection]\n\nprospect context: [relevant detail]' },
];

const AGENT_GROUPS = {
  'Research & plan': ['generalResearch'],
  'Create & earn': ['listingCreator', 'bulkListingGenerator', 'imageGenerator', 'articleDrafter', 'eventPromoter', 'contentRepurposer'],
  'Win work': ['salesDevelopment', 'applicationWriter', 'messageDrafter', 'pricingAdviser', 'revenueIntelligence'],
  'Grow & connect': ['matchFinder', 'collabMatchmaker', 'reputationCoach', 'trustScoreOptimiser'],
} as const;

type ActionIdea = {
  agentName: string;
  label: string;
  icon: 'listing' | 'event' | 'message' | 'buyers';
  sparkle?: boolean;
  starterPrompt: string;
};

const ACTION_IDEAS: ActionIdea[] = [
  {
    agentName: 'listingCreator',
    label: 'Create\na listing',
    icon: 'listing',
    sparkle: true,
    starterPrompt: 'What do you want to list on FreeTrust? Tell me if it is a service or product, the title, price, location/online details, and any photos or notes you want me to use.',
  },
  {
    agentName: 'eventPromoter',
    label: 'Publish\nan event',
    icon: 'event',
    sparkle: true,
    starterPrompt: 'What event do you want to publish? Tell me the title, date/time, location or online link, audience, price if any, and what people should know before they RSVP.',
  },
  {
    agentName: 'messageDrafter',
    label: 'Draft + send\nmessage',
    icon: 'message',
    sparkle: true,
    starterPrompt: 'Who do you want to message, and what should the message be about? Tell me the recipient, the context, the tone, and the outcome you want from the message.',
  },
  {
    agentName: 'matchFinder',
    label: 'Find\nbuyers',
    icon: 'buyers',
    starterPrompt: 'What are you trying to sell, promote, or match? Tell me the offer, who you think it helps, your price or budget, and what kind of buyers or collaborators you want me to find.',
  },
];

const DEFAULT_AGENT = AGENT_LIST.find((agent) => agent.name === 'generalResearch') ?? AGENT_LIST[0];

function getAgentByName(name: string) {
  return AGENT_LIST.find((agent) => agent.name === name) ?? null;
}

function AgentLineIcon({ name }: { name: 'listing' | 'event' | 'message' | 'buyers' | 'preview' | 'mic' | 'wave' }) {
  if (name === 'event') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3.5v3M17 3.5v3M5 9h14M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === 'message') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v4A3.5 3.5 0 0 1 15.5 15H12l-4.2 3.5V15A3.5 3.5 0 0 1 5 11.5v-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 9.5h6M9 12h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === 'buyers') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.8"/><path d="M3.8 19a4.8 4.8 0 0 1 9.4 0M12.2 18.6a4 4 0 0 1 7.9.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  if (name === 'mic') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.9"/><path d="M6 10.5a6 6 0 0 0 12 0M12 16.5V21M9 21h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>;
  if (name === 'wave') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10v4M9 7v10M13 4.5v15M17 8v8M21 11v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4h8l3 3v13H7V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M15 4v4h4M10 11h6M10 14h6M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return String(value ?? '');
  const obj = value as Record<string, unknown>;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();

  if (obj.type === 'generated_image') {
    const caption = typeof obj.caption === 'string' && obj.caption.trim() ? obj.caption.trim() : 'Generated image ready.';
    const safety = typeof obj.safety_note === 'string' && obj.safety_note.trim() ? `\n\nSafety check\n\n${obj.safety_note.trim()}` : '';
    const revisedPrompt = typeof obj.revised_prompt === 'string' && obj.revised_prompt.trim() ? `\n\nPrompt used\n\n${obj.revised_prompt.trim()}` : '';
    return `${caption}${safety}${revisedPrompt}`.trim();
  }

  const primaryDraft = typeof obj.primary_draft === 'string' ? obj.primary_draft.trim() : '';
  const linkedinPost = typeof obj.linkedin_post === 'string' ? obj.linkedin_post.trim() : '';
  const socialPost = typeof obj.social_post === 'string' ? obj.social_post.trim() : '';
  const socialPostLong = typeof obj.social_post_long === 'string' ? obj.social_post_long.trim() : '';
  const socialCaption = typeof obj.social_caption === 'string' ? obj.social_caption.trim() : '';
  const emailSubject = typeof obj.email_subject === 'string' ? obj.email_subject.trim() : '';
  const emailBody = typeof obj.email_body === 'string' ? obj.email_body.trim() : '';
  if (primaryDraft || linkedinPost || socialPost || socialPostLong || socialCaption || emailSubject || emailBody) {
    const sections: string[] = [];
    const platform = typeof obj.platform === 'string' && obj.platform.trim() ? obj.platform.trim() : 'Social post';
    const main = primaryDraft || linkedinPost || socialPost || socialPostLong || socialCaption;
    if (main) sections.push(`${platform} draft\n\n${main}`);
    if (emailSubject || emailBody) sections.push(`Email draft\n\n${emailSubject ? `Subject: ${emailSubject}\n\n` : ''}${emailBody}`.trim());
    if (socialCaption && socialCaption !== main) sections.push(`Short caption\n\n${socialCaption}`);
    if (typeof obj.tone_notes === 'string' && obj.tone_notes.trim()) sections.push(`Tone notes\n\n${obj.tone_notes.trim()}`);
    if (typeof obj.suggested_next_action === 'string' && obj.suggested_next_action.trim()) sections.push(`Next action\n\n${obj.suggested_next_action.trim()}`);
    return sections.join('\n\n');
  }

  const messageBody = typeof obj.body === 'string' ? obj.body.trim() : '';
  if (messageBody && ('subject' in obj || 'tone_notes' in obj)) {
    const subject = typeof obj.subject === 'string' && obj.subject.trim() ? `Subject: ${obj.subject.trim()}\n\n` : '';
    const notes = typeof obj.tone_notes === 'string' && obj.tone_notes.trim() ? `\n\nTone notes\n\n${obj.tone_notes.trim()}` : '';
    return `${subject}${messageBody}${notes}`.trim();
  }

  const preferred = [
    obj.title,
    obj.short_description,
    obj.hook,
    obj.event_description,
    obj.social_post_long,
    obj.message,
    obj.recommendation,
  ].filter((part): part is string => typeof part === 'string' && Boolean(part.trim()));
  const details = JSON.stringify(value, null, 2);
  return preferred.length ? preferred.join('\n\n') : details;
}

function stripChatFormattingMarkers(text: string): string {
  return text
    .replace(/[＊*]/g, '')
    .replace(/[‐‑‒–—―-]/g, ' ')
    .replace(/^[ \t]*[•·▪▫◦]+[ \t]*/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanAssistantText(text: string): string {
  return stripChatFormattingMarkers(text
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function messageExcerpt(content: string, max = 140) {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function conversationTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((message) => message.role === 'user')?.content;
  return messageExcerpt(firstUser || 'New FreeTrust agent chat', 64);
}

function sanitiseMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    actions: message.actions,
    raw: sanitiseRawForStorage(message.raw),
    attachments: message.attachments?.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      kind: attachment.kind,
      note: attachment.note,
    })),
  }));
}

function sanitiseRawForStorage(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  if (data.type === 'generated_image' && typeof data.image_url === 'string') {
    return {
      type: 'generated_image',
      image_url: data.image_url,
      media_url: data.media_url,
      revised_prompt: typeof data.revised_prompt === 'string' ? data.revised_prompt : undefined,
      safety_note: typeof data.safety_note === 'string' ? data.safety_note : undefined,
      caption: typeof data.caption === 'string' ? data.caption : undefined,
    };
  }
  return undefined;
}

function readSavedConversations(): SavedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONVERSATION_HISTORY_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedConversation => Boolean(item && typeof item === 'object' && typeof item.id === 'string' && Array.isArray(item.messages)));
  } catch {
    return [];
  }
}

function writeSavedConversations(conversations: SavedConversation[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONVERSATION_HISTORY_KEY, JSON.stringify(conversations.slice(0, MAX_SAVED_CONVERSATIONS)));
  } catch { /* ignore local history persistence */ }
}

const DIRECT_MESSAGE_PATTERN = /\b(message|dm|direct message|reply|respond|conversation|inbox|buyer enquiry|buyer inquiry|seller|buyer)\b/i;
const SOCIAL_CHANNEL_PATTERN = /\b(linkedin|instagram|facebook|twitter|\bx\b|social|feed)\b/i;
const SOCIAL_POST_PATTERN = /\b(post|caption|announce|announcement|launch|promo|promote|public)\b/i;

const ACTION_INTENT_PATTERNS: Array<{ agent: string; patterns: RegExp[] }> = [
  { agent: 'imageGenerator', patterns: [/\b(generate|create|make|design|draw|produce)\b[\s\S]{0,80}\b(image|picture|photo|visual|poster|graphic|banner|thumbnail|artwork|illustration)\b/i, /\b(image|picture|photo|visual|poster|graphic|banner|thumbnail|artwork|illustration)\b[\s\S]{0,80}\b(generate|create|make|design|draw|produce)\b/i] },
  { agent: 'contentRepurposer', patterns: [/\b(linkedin|instagram|facebook|twitter|\bx\b|social|feed)\b[\s\S]{0,80}\b(post|caption|announce|announcement|launch|promo|promote|public)\b/i, /\b(post|caption|announce|announcement|launch|promo|promote|public)\b[\s\S]{0,80}\b(linkedin|instagram|facebook|twitter|\bx\b|social|feed)\b/i] },
  { agent: 'listingCreator', patterns: [/\b(create|make|draft|write|generate|list)\b[\s\S]{0,40}\b(listing|service|product|offer)\b/i, /\b(price|sell|selling)\b[\s\S]{0,40}\b(service|product|offer|listing)\b/i] },
  { agent: 'eventPromoter', patterns: [/\b(event|meetup|workshop|webinar)\b/i] },
  { agent: 'messageDrafter', patterns: [/\b(message|dm|reply|respond|conversation)\b/i] },
  { agent: 'matchFinder', patterns: [/\b(find|match|buyers|collaborators|partners)\b/i] },
];

function resolveActionAgent(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const directMessage = DIRECT_MESSAGE_PATTERN.test(trimmed);
  const socialPost = (SOCIAL_CHANNEL_PATTERN.test(trimmed) && SOCIAL_POST_PATTERN.test(trimmed)) || /\b(write|draft|create|make)\b[\s\S]{0,60}\bpost\b/i.test(trimmed);
  if (directMessage && !socialPost) return getAgentByName('messageDrafter');
  if (socialPost) return getAgentByName('contentRepurposer');
  const matched = ACTION_INTENT_PATTERNS.find((item) => item.patterns.some((pattern) => pattern.test(trimmed)));
  return matched ? getAgentByName(matched.agent) : null;
}

function shouldAutoResearch(input: string, selectedAgent: AgentConfig) {
  if (selectedAgent.name === 'generalResearch') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  const hasQuestionShape = /\?$|\b(what|why|how|should|research|analyse|analyze|compare|strategy|improve|best practices|competitor|market|plan)\b/i.test(trimmed);
  if (!hasQuestionShape) return false;
  const matchingActionIntent = ACTION_INTENT_PATTERNS.find((item) => item.agent === selectedAgent.name);
  if (matchingActionIntent?.patterns.some((pattern) => pattern.test(trimmed))) return false;
  return true;
}

function resolveAgentForInput(input: string, selectedAgent: AgentConfig) {
  const actionAgent = resolveActionAgent(input);
  if (actionAgent) {
    if (actionAgent.name === 'contentRepurposer' && selectedAgent.name !== 'contentRepurposer') return actionAgent;
    if (selectedAgent.name === 'generalResearch') return actionAgent;
  }
  if (!shouldAutoResearch(input, selectedAgent)) return selectedAgent;
  return getAgentByName('generalResearch') ?? selectedAgent;
}

function SendArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function generatedImageFromRaw(raw: unknown): { url: string; safetyNote?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const url = typeof data.image_url === 'string' ? data.image_url : typeof data.media_url === 'string' ? data.media_url : '';
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    safetyNote: typeof data.safety_note === 'string' ? data.safety_note : undefined,
  };
}

function numberFrom(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function inferActions(agent: AgentConfig, raw: unknown): AgentAction[] {
  if (!raw || typeof raw !== 'object') {
    if (agent.name === 'messageDrafter' || agent.name === 'salesDevelopment' || agent.name === 'collabMatchmaker') {
      return [{ id: makeId('action'), kind: 'prepare_message', label: 'Prepare in Messages', helper: 'Save this as an editable FreeTrust message draft and choose where to send it.', payload: { text: stringifyOutput(raw), source: agent.name } }];
    }
    return [];
  }

  const data = raw as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title : '';
  const shortDescription = typeof data.short_description === 'string' ? data.short_description : '';
  const longDescription = typeof data.long_description === 'string' ? data.long_description : '';
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const price = numberFrom(data.suggested_price_eur, 0);
  const actions: AgentAction[] = [];

  if (agent.name === 'listingCreator') {
    const description = [shortDescription, longDescription].filter(Boolean).join('\n\n') || stringifyOutput(data);
    const basePayload = { title, description, price, currency: 'EUR', tags, category: 'General' };
    actions.push({ id: makeId('action'), kind: 'create_service', label: 'Create service listing', helper: 'Review/edit the fields, then create a live FreeTrust service.', payload: { ...basePayload, product_type: 'service', service_mode: 'online' } });
    actions.push({ id: makeId('action'), kind: 'create_product', label: 'Create product listing', helper: 'Use this if the offer is a physical/digital product rather than a service.', payload: { ...basePayload, product_type: 'physical' } });
  }

  if (agent.name === 'articleDrafter') {
    const body = [data.hook, data.body_markdown, data.call_to_action].filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).join('\n\n');
    actions.push({ id: makeId('action'), kind: 'publish_article', label: 'Publish article', helper: 'Review/edit before publishing to FreeTrust Articles.', payload: { title, body, category: 'General' } });
  }

  if (agent.name === 'eventPromoter') {
    const description = typeof data.event_description === 'string' ? data.event_description : stringifyOutput(data);
    const social = typeof data.social_post_long === 'string' ? data.social_post_long : typeof data.social_post_short === 'string' ? data.social_post_short : description;
    actions.push({ id: makeId('action'), kind: 'create_feed_post', label: 'Post event promo to feed', helper: 'Create an editable FreeTrust feed post from the event promo draft.', payload: { content: social } });
    actions.push({ id: makeId('action'), kind: 'create_event', label: 'Create event draft', helper: 'Add/check start_date before publishing the event.', payload: { title: title || 'Untitled event', description, start_date: '', price: 0, category: 'Events' } });
  }

  if (agent.name === 'contentRepurposer') {
    const content = [data.primary_draft, data.linkedin_post, data.social_post, data.social_post_long, data.social_caption, stringifyOutput(data)]
      .find((part): part is string => typeof part === 'string' && Boolean(part.trim())) ?? stringifyOutput(data);
    const platform = typeof data.platform === 'string' && data.platform.trim() ? data.platform.trim() : 'social';
    actions.push({ id: makeId('action'), kind: 'prepare_social_post', label: 'Prepare social draft', helper: `Review/edit this ${platform} draft before posting outside FreeTrust.`, payload: { text: content, platform, source: agent.name } });
    actions.push({ id: makeId('action'), kind: 'create_feed_post', label: 'Post to FreeTrust feed', helper: 'Optionally adapt this as a FreeTrust feed post after review.', payload: { content } });
  }

  if (agent.name === 'imageGenerator') {
    const imageUrl = typeof data.image_url === 'string' ? data.image_url : typeof data.media_url === 'string' ? data.media_url : '';
    const caption = typeof data.caption === 'string' && data.caption.trim() ? data.caption.trim() : 'Generated with FreeTrust Agent.';
    if (imageUrl) {
      actions.push({
        id: makeId('action'),
        kind: 'create_feed_post',
        label: 'Post image to feed',
        helper: 'Review the caption before publishing this generated image to your FreeTrust feed.',
        payload: { content: caption, media_url: imageUrl, media_type: 'image' },
      });
    }
  }

  if (agent.name === 'messageDrafter' || agent.name === 'salesDevelopment' || agent.name === 'collabMatchmaker' || agent.name === 'matchFinder') {
    actions.push({ id: makeId('action'), kind: 'prepare_message', label: agent.name === 'matchFinder' ? 'Open action plan' : 'Prepare in Messages', helper: agent.name === 'matchFinder' ? 'Keep this as an actionable matching plan inside FreeTrust.' : 'Save this as an editable FreeTrust message draft and choose where to send it.', payload: { text: stringifyOutput(data), source: agent.name } });
  }

  return actions;
}

async function readFileAsAttachment(file: File): Promise<AgentAttachment> {
  const base = { id: makeId('att'), name: file.name, type: file.type || 'unknown', size: file.size };

  if (IMAGE_TYPES.has(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ...base, kind: 'file', note: 'Photo is too large for AI vision in this run. Try a smaller image.' };
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
    return { ...base, kind: 'image', dataUrl };
  }

  const looksText = TEXT_TYPES.has(file.type) || /\.(txt|md|csv|json)$/i.test(file.name);
  if (looksText) {
    if (file.size > MAX_TEXT_BYTES) {
      return { ...base, kind: 'file', note: 'Text file is too large to read into this agent run.' };
    }
    const content = await file.text();
    return { ...base, kind: 'text', content };
  }

  return { ...base, kind: 'file', note: 'Attached as metadata only. Paste important text if you want the agent to read it.' };
}

function ActionCard({ action }: { action: AgentAction }) {
  const [payloadText, setPayloadText] = useState(() => {
    if (action.kind === 'prepare_message' || action.kind === 'prepare_social_post') {
      return String(action.payload.text ?? action.payload.content ?? '');
    }
    return JSON.stringify(action.payload, null, 2);
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function execute() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      if (action.kind === 'prepare_message') {
        try {
          window.localStorage.setItem('freetrust.agent.messageDraft.v1', JSON.stringify({
            text: payloadText.trim(),
            source: String(action.payload.source ?? 'agent'),
            createdAt: new Date().toISOString(),
          }));
        } catch { /* ignore local draft persistence */ }
        setStatus('Draft saved. Open Messages to choose a conversation and send it.');
        return;
      }

      if (action.kind === 'prepare_social_post') {
        try {
          window.localStorage.setItem('freetrust.agent.socialPostDraft.v1', JSON.stringify({
            text: payloadText.trim(),
            platform: String(action.payload.platform ?? 'social'),
            source: String(action.payload.source ?? 'agent'),
            createdAt: new Date().toISOString(),
          }));
        } catch { /* ignore local draft persistence */ }
        setStatus('Social draft saved on this device. Review it before posting publicly.');
        return;
      }

      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      let res: Response;
      let successMessage = 'Done.';

      if (action.kind === 'create_service' || action.kind === 'create_product') {
        res = await fetch('/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: String(payload.title ?? '').trim(),
            description: String(payload.description ?? '').trim(),
            price: numberFrom(payload.price, 0),
            currency: String(payload.currency ?? 'EUR'),
            product_type: action.kind === 'create_service' ? 'service' : String(payload.product_type ?? 'physical'),
            category: String(payload.category ?? 'General'),
            service_mode: String(payload.service_mode ?? 'online'),
            tags: Array.isArray(payload.tags) ? payload.tags : [],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data.error ?? 'Could not create listing'));
        const id = data?.listing?.id;
        successMessage = id ? `Created. Open: ${action.kind === 'create_service' ? `/services/${id}` : `/products/${id}`}` : 'Listing created.';
        setStatus(successMessage);
        return;
      }

      if (action.kind === 'publish_article') {
        res = await fetch('/api/create/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'article', data: { title: payload.title, body: payload.body }, category: payload.category ?? 'General' }),
        });
      } else if (action.kind === 'create_event') {
        res = await fetch('/api/create/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'event', data: payload, category: payload.category ?? 'Events' }),
        });
      } else {
        res = await fetch('/api/create/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: payload.media_url ? 'photo' : 'text',
            data: {
              content: payload.content ?? payload.text ?? '',
              media_url: payload.media_url ?? null,
              media_type: payload.media_type ?? (payload.media_url ? 'image' : null),
            },
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data.error ?? 'Action failed'));
      setStatus(data.redirectUrl ? `Published. Open: ${data.redirectUrl}` : 'Published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="action-card">
      <div className="action-top">
        <div>
          <div className="action-label">{action.label}</div>
          <div className="action-helper">{action.helper}</div>
        </div>
        <span className="confirm-chip">Needs tap</span>
      </div>
      <textarea className="action-payload" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} disabled={busy} />
      <button type="button" className="action-btn" onClick={execute} disabled={busy}>{busy ? 'Working…' : action.label}</button>
      {status && <div className="action-status">{status}</div>}
      {error && <div className="action-error">{error}</div>}
    </div>
  );
}

export default function AgentsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig>(DEFAULT_AGENT);
  const [conversationId, setConversationId] = useState(() => makeId('conversation'));
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const deepLinkLoadedRef = useRef(false);

  const groupedAgents = useMemo(() => Object.entries(AGENT_GROUPS).map(([label, keys]) => ({
    label,
    agents: keys.map((key) => AGENT_LIST.find((agent) => agent.name === key)).filter((agent): agent is AgentConfig => Boolean(agent)),
  })), []);

  const ideaAgents = useMemo(() => [
    ...ACTION_IDEAS.map((idea) => {
      const agent = AGENT_LIST.find((item) => item.name === idea.agentName);
      return agent ? { ...idea, agent } : null;
    }).filter((idea): idea is (typeof ACTION_IDEAS[number] & { agent: AgentConfig }) => Boolean(idea)),
  ], []);

  const latestAction = useMemo(() => {
    const confirmableKinds = new Set<AgentActionKind>(['create_service', 'create_product', 'publish_article', 'create_event', 'create_feed_post']);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const action = messages[index].actions?.find((item) => confirmableKinds.has(item.kind));
      if (action) return action;
    }
    return null;
  }, [messages]);

  const hasTypedInput = input.trim().length > 0 || attachments.length > 0;
  const conversationActive = messages.length > 0 || hasTypedInput;

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/credits/balance', { cache: 'no-store' });
      if (res.status === 401) return setBalance(null);
      const data = await res.json();
      if (typeof data.balance === 'number') setBalance(data.balance);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { setSavedConversations(readSavedConversations()); }, []);
  useEffect(() => {
    if (deepLinkLoadedRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt')?.trim();
    if (!prompt) return;
    deepLinkLoadedRef.current = true;
    const agentName = params.get('agent')?.trim() || 'generalResearch';
    const agent = getAgentByName(agentName) ?? DEFAULT_AGENT;
    setConversationId(makeId('conversation'));
    setSelectedAgent(agent);
    setMessages([{ id: makeId('msg'), role: 'assistant', content: cleanAssistantText(`I've prefilled ${agent.displayName} from FitPlan. Review it, then tap run when you're ready.`) }]);
    setAttachments([]);
    setInput(prompt);
    setError(null);
    setIdeaOpen(false);
    setMenuOpen(false);
  }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, running]);
  useEffect(() => {
    if (messages.length === 0) return;
    const conversation: SavedConversation = {
      id: conversationId,
      title: conversationTitle(messages),
      agentName: selectedAgent.name,
      updatedAt: new Date().toISOString(),
      messages: sanitiseMessagesForStorage(messages),
    };
    setSavedConversations((current) => {
      const next = [conversation, ...current.filter((item) => item.id !== conversationId)].slice(0, MAX_SAVED_CONVERSATIONS);
      writeSavedConversations(next);
      return next;
    });
  }, [conversationId, messages, selectedAgent.name]);

  function loadConversation(conversation: SavedConversation) {
    const agent = getAgentByName(conversation.agentName) ?? DEFAULT_AGENT;
    setConversationId(conversation.id);
    setSelectedAgent(agent);
    setMessages(conversation.messages);
    setAttachments([]);
    setInput('');
    setError(null);
    setMenuOpen(false);
  }

  function startNewConversation() {
    setConversationId(makeId('conversation'));
    setSelectedAgent(DEFAULT_AGENT);
    setMessages([]);
    setAttachments([]);
    setInput('');
    setError(null);
    setMenuOpen(false);
  }

  function startIdeaConversation(idea: ActionIdea & { agent: AgentConfig }) {
    setConversationId(makeId('conversation'));
    setSelectedAgent(idea.agent);
    setMessages([{ id: makeId('msg'), role: 'assistant', content: cleanAssistantText(idea.starterPrompt) }]);
    setAttachments([]);
    setInput('');
    setError(null);
    setIdeaOpen(false);
    setMenuOpen(false);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const picked = Array.from(files).slice(0, room);
    try {
      const read = await Promise.all(picked.map(readFileAsAttachment));
      setAttachments((current) => [...current, ...read].slice(0, MAX_ATTACHMENTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read attachment');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function runAgent() {
    const trimmed = input.trim();
    if (!selectedAgent || (!trimmed && attachments.length === 0)) return;
    const cleanedInput = stripChatFormattingMarkers(trimmed);
    const runWithAgent = resolveAgentForInput(cleanedInput, selectedAgent);
    if (runWithAgent.name !== selectedAgent.name) setSelectedAgent(runWithAgent);

    const userMessage: ChatMessage = { id: makeId('msg'), role: 'user', content: cleanedInput || 'Use the attached files/photos as context.', attachments };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setAttachments([]);
    setRunning(true);
    setError(null);

    const assistantId = makeId('msg');
    try {
      if (runWithAgent.streaming) {
        setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: '' }]);
        const res = await fetch('/api/agents/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: runWithAgent.name, input: cleanedInput, attachments: userMessage.attachments }),
        });
        if (res.status === 401) throw new Error('You need to sign in to run agents.');
        if (res.status === 402) throw new Error(`Not enough AI Credits. You need ${runWithAgent.creditCost}.`);
        if (!res.ok || !res.body) throw new Error('Agent stream failed.');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let output = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const event of events) {
            const line = event.split('\n').find((part) => part.startsWith('data: '));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as { type?: string; text?: string; error?: string; newBalance?: number | null };
            if (payload.type === 'delta' && typeof payload.text === 'string') {
              output += payload.text;
              setMessages((current) => current.map((msg) => msg.id === assistantId ? { ...msg, content: cleanAssistantText(output) } : msg));
            }
            if (payload.type === 'done' && typeof payload.newBalance === 'number') setBalance(payload.newBalance);
            if (payload.type === 'error') throw new Error(payload.error ?? 'Agent stream failed.');
          }
        }
        return;
      }

      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: runWithAgent.name, input: cleanedInput, attachments: userMessage.attachments }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('You need to sign in to run agents.');
        if (res.status === 402 || data.error === 'insufficient_credits') throw new Error(`Not enough AI Credits. You need ${runWithAgent.creditCost}.`);
        throw new Error(data.error ?? 'Agent run failed.');
      }
      const raw = data.data;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: cleanAssistantText(stringifyOutput(raw)),
        actions: inferActions(runWithAgent, raw),
        raw,
      };
      setMessages((current) => [...current, assistantMessage]);
      if (typeof data.newBalance === 'number') setBalance(data.newBalance);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent run failed.';
      setError(message);
      setMessages((current) => [...current, { id: assistantId, role: 'assistant', content: cleanAssistantText(`I couldn't complete that run: ${message}`) }]);
    } finally {
      setRunning(false);
    }
  }

  function applyExample() {
    const guidance = AGENT_INPUT_GUIDANCE[selectedAgent.name];
    if (guidance) setInput(guidance.example);
  }

  return (
    <div className="agents-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .agents-page { color: ${COLORS.text}; width: 100%; min-height: 100dvh; background: radial-gradient(circle at 50% 30%, rgba(14,165,233,0.16), transparent 28%), radial-gradient(circle at 78% 5%, rgba(56,189,248,0.08), transparent 18%), radial-gradient(circle at 22% 96%, rgba(14,116,144,0.13), transparent 32%), #030712; overflow: hidden; }
        .agents-page, .agents-page * { box-sizing: border-box; }
        [class^="ta-"], [class*=" ta-"] { display: none !important; }
        .agents-page::before { content: ''; position: absolute; inset: 9% 5% auto; height: 52dvh; border-radius: 38%; background: radial-gradient(circle at 50% 45%, rgba(15,23,42,0.58), rgba(15,23,42,0.16) 45%, transparent 72%); pointer-events: none; }
        .immersive-shell { min-height: 100dvh; max-width: 760px; margin: 0 auto; padding: calc(18px + env(safe-area-inset-top, 0px)) 24px calc(14px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; position: relative; }
        .top-row { display: flex; align-items: center; justify-content: space-between; min-height: 52px; z-index: 4; }
        .round-control { width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(148,163,184,0.22); background: rgba(15,23,42,0.48); color: ${COLORS.text}; display: grid; place-items: center; text-decoration: none; font: inherit; font-size: 21px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025), 0 12px 36px rgba(0,0,0,0.24); backdrop-filter: blur(18px); -webkit-tap-highlight-color: transparent; }
        .idea-control { border-color: rgba(56,189,248,0.32); color: #67e8f9; background: rgba(8,47,73,0.30); }
        .idea-control svg { width: 25px; height: 25px; filter: drop-shadow(0 0 10px rgba(56,189,248,0.45)); }
        .round-control:active { transform: scale(0.97); }
        .tiny-status { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(56,189,248,0.18); color: ${COLORS.textMuted}; background: rgba(15,23,42,0.52); border-radius: 999px; padding: 9px 12px; font-size: 12px; text-decoration: none; backdrop-filter: blur(16px); }
        .stage { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; min-height: 0; padding: 0 0 10px; transition: justify-content .25s ease; }
        .stage.has-messages { justify-content: flex-start; padding-top: 8px; }
        .brand-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: clamp(66px, 15dvh, 138px); transition: margin .25s ease; }
        .stage.has-messages .brand-center { margin-top: 0; }
        .logo-orb { width: 112px; height: 112px; border-radius: 34px; display: grid; place-items: center; background: radial-gradient(circle, rgba(103,232,249,0.18), rgba(14,165,233,0.10) 38%, rgba(15,23,42,0.02) 72%); filter: drop-shadow(0 0 34px rgba(56,189,248,0.42)); transition: width .25s ease, height .25s ease; }
        .stage.has-messages .logo-orb { width: 58px; height: 58px; }
        .logo-orb img { width: 88%; height: 88%; object-fit: contain; filter: drop-shadow(0 0 15px rgba(125,211,252,0.88)); }
        .greeting { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 42px; line-height: 1.02; color: rgba(241,245,249,0.94); letter-spacing: -0.065em; font-weight: 850; margin: 2px 0 0; transition: font-size .25s ease; text-shadow: 0 0 28px rgba(15,23,42,0.28); }
        .stage.has-messages .greeting { font-size: 24px; }
        .sub-greeting { color: rgba(186,205,229,0.78); font-size: 17px; line-height: 1.35; max-width: 420px; margin: 0; letter-spacing: -0.01em; }
        .idea-stream-wrap { position: relative; width: 100%; margin-top: 34px; }
        .idea-stream { width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 1px 0 3px; }
        .sheet-idea-stream { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
        .idea-stream::-webkit-scrollbar { display: none; }
        .idea-next { display: none; }
        .idea-chip { width: 100%; min-width: 0; border: 1px solid rgba(148,163,184,0.18); background: linear-gradient(135deg, rgba(30,41,59,0.44), rgba(15,23,42,0.30)); color: rgba(241,245,249,0.88); border-radius: 15px; padding: 9px 8px; font-size: 12px; font-weight: 750; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font: inherit; min-height: 50px; text-align: left; box-shadow: inset 0 1px 0 rgba(255,255,255,0.035); backdrop-filter: blur(16px); }
        .idea-chip.active { border-color: rgba(56,189,248,0.44); background: linear-gradient(135deg, rgba(14,116,144,0.32), rgba(15,23,42,0.40)); box-shadow: inset 0 0 0 1px rgba(56,189,248,0.10), 0 0 24px rgba(14,165,233,0.10); }
        .idea-chip-icon { color: #67e8f9; width: 18px; min-width: 18px; height: 18px; display: grid; place-items: center; filter: drop-shadow(0 0 6px rgba(56,189,248,0.28)); }
        .idea-chip-icon svg, .preview-icon svg, .mic-btn svg, .send-btn svg { width: 100%; height: 100%; display: block; }
        .idea-chip-label { white-space: pre-line; line-height: 1.18; }
        .chip-sparkle { color: #67e8f9; margin-left: auto; align-self: flex-end; font-size: 10px; }
        .messages { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 0 10px; display: flex; flex-direction: column; gap: 14px; }
        .stage.has-messages .messages { padding-top: 6px; }
        .message { display: flex; gap: 10px; align-items: flex-start; }
        .message.user { flex-direction: row-reverse; }
        .avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(56,189,248,0.12); display: grid; place-items: center; flex-shrink: 0; font-size: 14px; }
        .message.user .avatar { font-size: 10px; color: ${COLORS.sky}; }
        .bubble { max-width: min(720px, 86%); border: 1px solid rgba(255,255,255,0.08); border-radius: 19px; padding: 13px 14px; background: rgba(30,41,59,0.72); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.52; font-size: 14px; backdrop-filter: blur(18px); }
        .message.user .bubble { background: rgba(56,189,248,0.13); border-color: rgba(56,189,248,0.18); }
        .attachment-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .attachment-chip { display: inline-flex; align-items: center; gap: 8px; border: 1px solid ${COLORS.borderMuted}; border-radius: 999px; padding: 7px 10px; color: ${COLORS.textMuted}; background: rgba(15,23,42,0.62); font-size: 12px; }
        .attachment-chip button { border: none; background: transparent; color: ${COLORS.textFaint}; cursor: pointer; font-size: 15px; min-width: 24px; min-height: 24px; }
        .generated-image-card { margin-top: 12px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(56,189,248,0.22); background: rgba(2,6,23,0.45); }
        .generated-image-card img { display: block; width: 100%; max-height: 420px; object-fit: cover; }
        .generated-image-note { padding: 9px 11px; color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.35; }
        .preview-strip { margin: 0 18px 18px; border: 1px solid rgba(148,163,184,0.20); border-radius: 22px; background: rgba(15,23,42,0.60); display: flex; align-items: center; gap: 12px; padding: 13px 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 50px rgba(0,0,0,0.22); backdrop-filter: blur(20px); }
        .preview-icon { width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(56,189,248,0.28); color: #67e8f9; display: grid; place-items: center; font-size: 22px; background: rgba(14,165,233,0.08); filter: drop-shadow(0 0 10px rgba(56,189,248,0.22)); flex: 0 0 auto; }
        .preview-copy { flex: 1; min-width: 0; color: rgba(210,222,239,0.94); font-size: 13px; line-height: 1.35; letter-spacing: -0.01em; }
        .preview-copy span { display: block; color: rgba(148,163,184,0.90); }
        .preview-actions { display: inline-flex; align-items: center; gap: 8px; color: rgba(148,163,184,0.58); font-size: 13px; }
        .preview-actions button { border: none; font: inherit; color: #67e8f9; background: transparent; padding: 7px 0; cursor: default; }
        .preview-actions .confirm-preview { padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(56,189,248,0.30); background: rgba(14,116,144,0.44); color: #bae6fd; }
        .composer { padding-top: 0; z-index: 3; }
        .composer-card { border: 1px solid rgba(148,163,184,0.22); border-radius: 30px; background: rgba(17,24,39,0.78); padding: 12px; box-shadow: 0 24px 70px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.045); backdrop-filter: blur(24px); }
        .composer textarea { width: 100%; min-height: 112px; max-height: 220px; resize: none; border: none; outline: none; background: transparent; color: ${COLORS.text}; font: inherit; font-size: 16px; line-height: 1.55; padding: 8px 16px 10px; }
        .composer textarea::placeholder { color: rgba(241,245,249,0.45); }
        .composer-bottom { display: flex; gap: 9px; align-items: center; justify-content: space-between; padding: 0 3px; }
        .composer-left, .composer-right { display: flex; gap: 8px; align-items: center; min-width: 0; }
        .attach-btn, .send-btn, .mic-btn, .agent-pill { min-height: 44px; border-radius: 999px; font-weight: 800; cursor: pointer; border: 1px solid rgba(148,163,184,0.18); font: inherit; -webkit-tap-highlight-color: transparent; }
        .attach-btn, .mic-btn { width: 44px; padding: 0; background: rgba(15,23,42,0.58); color: ${COLORS.text}; font-size: 27px; display: grid; place-items: center; }
        .mic-btn { font-size: 21px; color: rgba(241,245,249,0.78); }
        .mic-btn svg { width: 21px; height: 21px; }
        .mic-btn:disabled { opacity: 1; }
        .agent-pill { max-width: 210px; padding: 0 14px; background: rgba(15,23,42,0.56); color: ${COLORS.text}; display: inline-flex; align-items: center; gap: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .agent-pill img { width: 22px; height: 22px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(56,189,248,0.45)); }
        .agent-pill small { color: ${COLORS.textMuted}; font-weight: 600; }
        .agent-pill-chevron { color: rgba(226,232,240,0.78); margin-left: 2px; }
        .send-btn { background: #f8fafc; color: #0f172a; border-color: transparent; display: grid; place-items: center; transition: width .18s ease, min-width .18s ease, min-height .18s ease, transform .18s ease, background .18s ease; }
        .send-btn-voice { width: 42px; min-width: 42px; min-height: 42px; font-size: 20px; }
        .send-btn-arrow { width: 38px; min-width: 38px; min-height: 38px; background: #e0f2fe; color: #082f49; align-self: center; }
        .send-btn svg { width: 20px; height: 20px; }
        .send-btn-arrow svg { width: 17px; height: 17px; }
        .send-btn:disabled { opacity: 1; cursor: not-allowed; background: #f8fafc; color: #0f172a; }
        .error { margin: 10px 0; border: 1px solid rgba(248,113,113,0.32); color: ${COLORS.danger}; background: rgba(248,113,113,0.08); border-radius: 14px; padding: 11px 12px; font-size: 13px; }
        .action-card { margin-top: 12px; border: 1px solid rgba(52,211,153,0.26); background: rgba(6,78,59,0.18); border-radius: 16px; padding: 12px; }
        .action-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
        .action-label { font-weight: 850; color: ${COLORS.text}; }
        .action-helper { color: ${COLORS.textMuted}; font-size: 12px; margin-top: 4px; line-height: 1.35; }
        .confirm-chip { color: ${COLORS.warning}; border: 1px solid rgba(251,191,36,0.28); border-radius: 999px; padding: 5px 8px; font-size: 11px; white-space: nowrap; }
        .action-payload { width: 100%; min-height: 116px; background: rgba(15,23,42,0.74); border: 1px solid ${COLORS.borderMuted}; color: ${COLORS.text}; border-radius: 12px; margin-top: 10px; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; line-height: 1.45; }
        .action-btn { width: 100%; min-height: 46px; margin-top: 10px; border: none; border-radius: 12px; background: ${COLORS.success}; color: #052e16; font-weight: 900; cursor: pointer; }
        .action-status { color: ${COLORS.success}; font-size: 12px; margin-top: 8px; }
        .action-error { color: ${COLORS.danger}; font-size: 12px; margin-top: 8px; }
        .idea-sheet-backdrop { position: absolute; inset: 0; z-index: 8; display: flex; align-items: flex-end; background: rgba(2,6,23,0.58); backdrop-filter: blur(14px); padding: 18px; }
        .idea-sheet { width: 100%; max-height: min(78dvh, 720px); overflow-y: auto; border: 1px solid rgba(255,255,255,0.12); background: rgba(15,23,42,0.94); border-radius: 30px 30px 22px 22px; box-shadow: 0 -24px 80px rgba(0,0,0,0.42); padding: 18px; }
        .menu-sheet-backdrop { position: absolute; inset: 0; z-index: 9; display: flex; align-items: flex-start; background: rgba(2,6,23,0.52); backdrop-filter: blur(14px); padding: calc(18px + env(safe-area-inset-top, 0px)) 18px 18px; }
        .menu-sheet { width: min(100%, 420px); max-height: min(76dvh, 620px); overflow-y: auto; border: 1px solid rgba(255,255,255,0.12); background: rgba(15,23,42,0.95); border-radius: 26px; box-shadow: 0 26px 80px rgba(0,0,0,0.42); padding: 16px; }
        .menu-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
        .menu-primary, .menu-secondary, .history-item { min-height: 44px; border-radius: 14px; border: 1px solid rgba(148,163,184,0.18); font: inherit; text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .menu-primary { display: grid; place-items: center; background: rgba(14,116,144,0.42); color: #bae6fd; font-weight: 850; }
        .menu-secondary { background: rgba(15,23,42,0.66); color: ${COLORS.text}; font-weight: 750; }
        .history-title { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #67e8f9; margin: 14px 2px 8px; }
        .history-list { display: grid; gap: 8px; }
        .history-item { width: 100%; text-align: left; background: rgba(30,41,59,0.62); color: inherit; padding: 11px 12px; }
        .history-item strong { display: block; font-size: 13px; line-height: 1.25; color: rgba(241,245,249,0.94); }
        .history-item span { display: block; color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.35; margin-top: 5px; }
        .history-empty { border: 1px dashed rgba(148,163,184,0.18); color: ${COLORS.textMuted}; border-radius: 14px; padding: 12px; font-size: 13px; line-height: 1.4; }
        .sheet-handle { width: 42px; height: 4px; border-radius: 999px; background: rgba(148,163,184,0.38); margin: 0 auto 16px; }
        .sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
        .sheet-title { font-size: 22px; font-weight: 900; letter-spacing: -0.04em; margin: 0; }
        .sheet-copy { color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.5; margin: 6px 0 0; }
        .sheet-close { border: 1px solid ${COLORS.borderMuted}; color: ${COLORS.text}; background: rgba(255,255,255,0.04); width: 42px; height: 42px; border-radius: 50%; font-size: 20px; }
        .agent-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .group-label { grid-column: 1 / -1; font-size: 11px; color: ${COLORS.sky}; letter-spacing: 1.8px; text-transform: uppercase; margin: 14px 0 2px; }
        .agent-card { width: 100%; min-height: 118px; text-align: left; color: inherit; background: rgba(30,41,59,0.72); border: 1px solid ${COLORS.borderMuted}; border-radius: 18px; padding: 14px; cursor: pointer; font: inherit; -webkit-tap-highlight-color: transparent; }
        .agent-card.active { border-color: ${COLORS.borderStrong}; background: rgba(56,189,248,0.10); }
        .agent-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .agent-name-wrap { display: flex; gap: 9px; align-items: center; min-width: 0; }
        .agent-icon { font-size: 22px; }
        .agent-name { font-weight: 800; font-size: 14px; }
        .agent-cost { color: ${COLORS.sky}; font-size: 12px; white-space: nowrap; }
        .agent-desc { color: ${COLORS.textMuted}; font-size: 12px; line-height: 1.38; }
        .action-principle { margin: 14px 0 4px; border: 1px solid rgba(52,211,153,0.22); background: rgba(52,211,153,0.07); color: rgba(209,250,229,0.94); border-radius: 16px; padding: 12px; font-size: 13px; line-height: 1.45; }
        @media (min-width: 720px) {
          .immersive-shell { padding-left: 28px; padding-right: 28px; }
          .greeting { font-size: 52px; }
          .stage.has-messages .greeting { font-size: 28px; }
          .composer-card { border-radius: 30px; }
        }
        @media (max-width: 520px) {
          .immersive-shell { padding-left: 15px; padding-right: 15px; }
          .tiny-status { display: none; }
          .agent-list { grid-template-columns: 1fr; }
          .brand-center { margin-top: clamp(66px, 14dvh, 120px); }
          .logo-orb { width: 106px; height: 106px; }
          .greeting { font-size: 40px; }
          .sub-greeting { font-size: 16px; }
          .idea-stream-wrap { margin-top: 30px; }
          .idea-stream { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .idea-chip { min-height: 48px; padding: 8px 9px; font-size: 12px; border-radius: 14px; }
          .idea-chip-icon { width: 17px; min-width: 17px; height: 17px; }
          .preview-strip { margin-left: 10px; margin-right: 10px; margin-bottom: 16px; padding: 12px; }
          .preview-actions { gap: 8px; }
          .agent-pill { max-width: 168px; }
          .composer-left { flex: 1; }
          .composer-right { flex-shrink: 0; }
          .bubble { max-width: 88%; }
        }
        @media (max-width: 380px) {
          .idea-chip { font-size: 11.5px; }
          .preview-strip { margin-left: 2px; margin-right: 2px; }
          .preview-actions { display: none; }
          .agent-pill { max-width: 146px; }
          .send-btn-voice { width: 40px; min-width: 40px; min-height: 40px; }
          .send-btn-arrow { width: 36px; min-width: 36px; min-height: 36px; }
        }
      ` }} />

        <div className="immersive-shell">
          <div className="top-row">
          <button type="button" className="round-control" aria-label="Open menu" onClick={() => setMenuOpen(true)}>☰</button>
          {balance !== null ? <span className="tiny-status">⚡ {balance.toLocaleString()} credits</span> : <Link href="/login" className="tiny-status">Sign in for agents</Link>}
          <button type="button" className="round-control idea-control" aria-label="Open ideas" onClick={() => setIdeaOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M8.25 14.4c-1.2-1-1.95-2.48-1.95-4.1A5.7 5.7 0 0 1 12 4.6a5.7 5.7 0 0 1 5.7 5.7c0 1.62-.75 3.1-1.95 4.1-.72.6-1.05 1.08-1.2 1.6h-5.1c-.15-.52-.48-1-1.2-1.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M12 8.1v3.4m-1.8-1.65L12 11.5l1.8-1.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <main className={`stage ${conversationActive ? 'has-messages' : ''}`}>
          {!conversationActive && <section className="brand-center" aria-label="FreeTrust Agents">
            <div className="logo-orb"><img src="/icons/freetrust-mark-perfect-transparent-20260521.png" alt="FreeTrust" /></div>
            <h1 className="greeting">FreeTrust</h1>
            <p className="sub-greeting">Ready to take action?</p>
            <div className="idea-stream-wrap">
              <div className="idea-stream" aria-label="Agent ideas">
                {ideaAgents.map((idea) => (
                  <button key={idea.agent.name} type="button" className={`idea-chip ${selectedAgent.name === idea.agent.name ? 'active' : ''}`} onClick={() => startIdeaConversation(idea)}>
                    <span className="idea-chip-icon"><AgentLineIcon name={idea.icon} /></span><span className="idea-chip-label">{idea.label}</span>{idea.sparkle && <span className="chip-sparkle">✦</span>}
                  </button>
                ))}
              </div>
              <span className="idea-next">›</span>
            </div>
          </section>}

          {error && <div className="error">{error}</div>}

          <div className="messages" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="avatar">{message.role === 'user' ? 'You' : selectedAgent.icon}</div>
                <div className="bubble">
                  {message.content}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="attachment-row">
                      {message.attachments.map((att) => <span key={att.id} className="attachment-chip">{att.kind === 'image' ? '🖼' : att.kind === 'text' ? '📄' : '📎'} {att.name}</span>)}
                    </div>
                  )}
                  {(() => {
                    const generatedImage = generatedImageFromRaw(message.raw);
                    if (!generatedImage) return null;
                    return (
                      <div className="generated-image-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={generatedImage.url} alt="Generated by FreeTrust Agent" loading="lazy" />
                        <div className="generated-image-note">{generatedImage.safetyNote ?? 'Checked by FreeTrust before upload.'}</div>
                      </div>
                    );
                  })()}
                  {message.actions?.map((action) => <ActionCard key={action.id} action={action} />)}
                </div>
              </div>
            ))}
            {running && <div className="message"><div className="avatar">{selectedAgent.icon}</div><div className="bubble">{selectedAgent.name === 'generalResearch' ? 'Researching…' : 'Working on an action preview…'}</div></div>}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {latestAction && (
          <div className="preview-strip" aria-label="FreeTrust action confirmation preview">
            <div className="preview-icon"><AgentLineIcon name="preview" /></div>
            <div className="preview-copy">
              {latestAction.label}
              <span>Confirm this FreeTrust platform action in the editable card above.</span>
            </div>
            <div className="preview-actions" aria-hidden="true">
              <button type="button" tabIndex={-1}>Edit</button>
              <span>|</span>
              <button type="button" className="confirm-preview" tabIndex={-1}>Confirm</button>
            </div>
          </div>
        )}

        <div className="composer">
          <div className="composer-card">
            {attachments.length > 0 && (
              <div className="attachment-row">
                {attachments.map((att) => (
                  <span key={att.id} className="attachment-chip" title={att.note ?? undefined}>
                    {att.kind === 'image' ? '🖼' : att.kind === 'text' ? '📄' : '📎'} {att.name}
                    {att.note ? ' · metadata only' : ''}
                    <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== att.id))} aria-label={`Remove ${att.name}`}>×</button>
                  </span>
                ))}
              </div>
            )}
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask FreeTrust to research, create, generate images, publish, message, list, or match…" disabled={running} />
            <div className="composer-bottom">
              <div className="composer-left">
                <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json,.pdf" style={{ display: 'none' }} onChange={(e) => onPickFiles(e.target.files)} />
                <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={running || attachments.length >= MAX_ATTACHMENTS} aria-label="Attach files">+</button>
                <button type="button" className="agent-pill" onClick={() => setIdeaOpen(true)} aria-label="Choose agent"><img src="/icons/freetrust-mark-perfect-transparent-20260521.png" alt="" /><span>FreeTrust Agent</span><span className="agent-pill-chevron">⌄</span></button>
              </div>
              <div className="composer-right">
                <button type="button" className="mic-btn" aria-label="Voice input coming soon" disabled><AgentLineIcon name="mic" /></button>
                <button type="button" className={`send-btn ${hasTypedInput ? 'send-btn-arrow' : 'send-btn-voice'}`} onClick={runAgent} disabled={running || (!input.trim() && attachments.length === 0)} aria-label={hasTypedInput ? 'Send message' : 'Ask agent'}>{running ? '…' : hasTypedInput ? <SendArrowIcon /> : <AgentLineIcon name="wave" />}</button>
              </div>
            </div>
          </div>
        </div>

        {ideaOpen && (
          <div className="idea-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Agent ideas">
            <section className="idea-sheet">
              <div className="sheet-handle" />
              <div className="sheet-head">
                <div>
                  <h2 className="sheet-title">What can FreeTrust do?</h2>
                  <p className="sheet-copy">Pick an agent or use an idea. Agents should create drafts, listings, posts, events, matches, and confirmations on-platform — not leave you copying text around.</p>
                </div>
                <button type="button" className="sheet-close" onClick={() => setIdeaOpen(false)} aria-label="Close ideas">×</button>
              </div>
              <div className="action-principle">No silent publishing. Every tangible FreeTrust action opens an editable preview first.</div>
              <div className="sheet-idea-stream" aria-label="Start with an action idea">
                {ideaAgents.map((idea) => (
                  <button key={idea.agent.name} type="button" className={`idea-chip ${selectedAgent.name === idea.agent.name ? 'active' : ''}`} onClick={() => startIdeaConversation(idea)}>
                    <span className="idea-chip-icon"><AgentLineIcon name={idea.icon} /></span><span className="idea-chip-label">{idea.label}</span>{idea.sparkle && <span className="chip-sparkle">✦</span>}
                  </button>
                ))}
                <button type="button" className="idea-chip" onClick={() => { applyExample(); setIdeaOpen(false); }}>✨ Use example</button>
                {selectedAgent.name === 'salesDevelopment' && SALES_DEV_TASKS.map((task) => <button key={task.key} type="button" className="idea-chip" onClick={() => { setInput(task.template); setIdeaOpen(false); }}>{task.label}</button>)}
              </div>
              <div className="agent-list">
                {groupedAgents.map((group) => (
                  <div key={group.label} style={{ display: 'contents' }}>
                    <div className="group-label">{group.label}</div>
                    {group.agents.map((agent) => (
                      <button key={agent.name} type="button" className={`agent-card ${selectedAgent.name === agent.name ? 'active' : ''}`} onClick={() => { setSelectedAgent(agent); setMessages([]); setError(null); setIdeaOpen(false); }}>
                        <div className="agent-head">
                          <div className="agent-name-wrap"><span className="agent-icon">{agent.icon}</span><span className="agent-name">{agent.displayName}</span></div>
                          <span className="agent-cost">{agent.creditCost}₮</span>
                        </div>
                        <div className="agent-desc">{agent.useCase || agent.oneLineDescription}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {menuOpen && (
          <div className="menu-sheet-backdrop" role="dialog" aria-modal="true" aria-label="FreeTrust Agents menu">
            <section className="menu-sheet">
              <div className="sheet-head">
                <div>
                  <h2 className="sheet-title">Menu</h2>
                  <p className="sheet-copy">Go back to FreeTrust or reopen previous prompts and messages.</p>
                </div>
                <button type="button" className="sheet-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
              </div>

              <div className="menu-actions">
                <Link href="/feed" className="menu-primary">Back to FreeTrust</Link>
                <button type="button" className="menu-secondary" onClick={startNewConversation}>New chat</button>
              </div>

              <div className="history-title">Previous prompts & messages</div>
              <div className="history-list">
                {savedConversations.length === 0 && <div className="history-empty">No saved prompts yet. Your recent agent chats will appear here on this device.</div>}
                {savedConversations.map((conversation) => {
                  const lastMessage = conversation.messages[conversation.messages.length - 1];
                  return (
                    <button key={conversation.id} type="button" className="history-item" onClick={() => loadConversation(conversation)}>
                      <strong>{conversation.title}</strong>
                      <span>{lastMessage ? `${lastMessage.role === 'user' ? 'You' : 'Agent'}: ${messageExcerpt(lastMessage.content, 92)}` : 'Open conversation'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
