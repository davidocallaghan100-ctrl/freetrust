import {
  executeMemberComposioAgentTool,
  type ComposioAgentTool,
} from '@/lib/integrations/composioServer'
import type {
  AgentModelMessage,
  AgentModelProvider,
  AgentModelRequest,
  AgentModelResponse,
  AgentModelToolDefinition,
} from './modelProvider'

const MAX_TOOL_ROUNDS = 4
const MAX_TOOL_RESULT_CHARS = 18_000

export type AgentPendingIntegrationAction = {
  id: string
  provider: string
  toolSlug: string
  toolName: string
  description: string
  accountName: string | null
  arguments: Record<string, unknown>
  message: string
}

export type ComposioAgentRunResult = {
  response: AgentModelResponse
  pendingAction?: AgentPendingIntegrationAction
  toolRounds: number
}

function modelTools(tools: ComposioAgentTool[]): AgentModelToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.toolSlug,
    description: `${tool.description} Connected app: ${tool.providerName}. This is a read-only lookup and may run automatically; do not use it to send, publish, update, or delete anything.`,
    inputSchema: tool.inputSchema,
  }))
}

function toolResultContent(value: unknown) {
  let serialised = ''
  try {
    serialised = JSON.stringify(value)
  } catch {
    serialised = String(value)
  }
  return serialised.slice(0, MAX_TOOL_RESULT_CHARS)
}

function assistantContent(response: AgentModelResponse) {
  if (response.content && response.content.length > 0) return response.content
  return response.text ? [{ type: 'text', text: response.text }] : []
}

export async function runAgentWithComposio(input: {
  userId: string
  provider: AgentModelProvider
  request: AgentModelRequest
  tools: ComposioAgentTool[]
}): Promise<ComposioAgentRunResult> {
  if (input.tools.length === 0) {
    return { response: await input.provider.create(input.request), toolRounds: 0 }
  }

  const toolsBySlug = new Map(input.tools.map((tool) => [tool.toolSlug, tool]))
  const messages: AgentModelMessage[] = [...input.request.messages]
  const requestTools = modelTools(input.tools)

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await input.provider.create({
      ...input.request,
      messages,
      tools: requestTools,
    })
    const calls = response.toolCalls ?? []
    if (calls.length === 0) return { response, toolRounds: round }

    messages.push({ role: 'assistant', content: assistantContent(response) })
    const toolResults: Array<Record<string, unknown>> = []
    for (const call of calls) {
      const tool = toolsBySlug.get(call.name)
      if (!tool) {
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'Tool is not available in this FreeTrust run.' })
        continue
      }
      try {
        const result = await executeMemberComposioAgentTool(input.userId, tool.toolSlug, call.input)
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: toolResultContent(result.data) })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connected-app lookup failed.'
        toolResults.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: message.slice(0, 500) })
      }
    }
    messages.push({ role: 'user', content: toolResults })
  }

  throw new Error('The connected-app agent reached its read limit before completing the request.')
}
