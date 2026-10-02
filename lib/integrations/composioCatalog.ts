export type ComposioProvider =
  | 'hubspot'
  | 'salesforce'
  | 'outlook'
  | 'whatsapp'
  | 'linkedin'
  | 'instagram'

export type ComposioProviderDefinition = {
  provider: ComposioProvider
  toolkit: string
  name: string
  icon: string
  description: string
  capabilities: string[]
  tone: string
}

export const COMPOSIO_PROVIDER_CATALOG: ComposioProviderDefinition[] = [
  {
    provider: 'hubspot',
    toolkit: 'hubspot',
    name: 'HubSpot',
    icon: '◈',
    description: 'Bring your CRM contacts and company context into member workflows.',
    capabilities: ['Contacts', 'Companies', 'CRM context'],
    tone: '#ff7a59',
  },
  {
    provider: 'salesforce',
    toolkit: 'salesforce',
    name: 'Salesforce',
    icon: '☁',
    description: 'Connect customer records and sales context from your own Salesforce account.',
    capabilities: ['Contacts', 'Accounts', 'Sales context'],
    tone: '#38bdf8',
  },
  {
    provider: 'outlook',
    toolkit: 'outlook',
    name: 'Microsoft 365',
    icon: '▦',
    description: 'Use your Microsoft email, calendar, and contacts where supported.',
    capabilities: ['Email', 'Calendar', 'Contacts'],
    tone: '#60a5fa',
  },
  {
    provider: 'whatsapp',
    toolkit: 'whatsapp',
    name: 'WhatsApp',
    icon: '◔',
    description: 'Keep approved member communications close to the work you do on FreeTrust.',
    capabilities: ['Messages', 'Notifications'],
    tone: '#34d399',
  },
  {
    provider: 'linkedin',
    toolkit: 'linkedin',
    name: 'LinkedIn',
    icon: 'in',
    description: 'Connect your professional identity for future member-approved workflows.',
    capabilities: ['Profile', 'Professional network'],
    tone: '#60a5fa',
  },
  {
    provider: 'instagram',
    toolkit: 'instagram',
    name: 'Instagram',
    icon: '◎',
    description: 'Connect your own Instagram account for member-approved social workflows.',
    capabilities: ['Profile', 'Social content'],
    tone: '#f472b6',
  },
]

export function getComposioProvider(provider: string) {
  return COMPOSIO_PROVIDER_CATALOG.find((item) => item.provider === provider) ?? null
}
