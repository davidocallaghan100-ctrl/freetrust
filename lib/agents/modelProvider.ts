import Anthropic from '@anthropic-ai/sdk'

export type AgentModelContent = string | Array<Record<string, unknown>>

export type AgentModelMessage = {
  role: 'user' | 'assistant'
  content: AgentModelContent
}

export type AgentModelToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type AgentModelToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
}

export type AgentModelRequest = {
  model: string
  maxTokens: number
  system: string
  messages: AgentModelMessage[]
  webSearch?: boolean
  tools?: AgentModelToolDefinition[]
}

export type AgentModelResponse = {
  model: string
  text: string
  usage: {
    inputTokens: number | null
    outputTokens: number | null
  }
  content?: Array<Record<string, unknown>>
  toolCalls?: AgentModelToolCall[]
  stopReason?: string | null
}

export type AgentModelStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'done'; usage: AgentModelResponse['usage'] }

export type AgentModelProviderName = 'anthropic' | 'openai-compatible'

export interface AgentModelProvider {
  readonly name: AgentModelProviderName
  create(request: AgentModelRequest): Promise<AgentModelResponse>
  stream(request: AgentModelRequest): AsyncIterable<AgentModelStreamEvent>
}

function textFromAnthropicContent(content: Anthropic.Messages.Message['content']): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim()
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

function toOpenAIContent(content: AgentModelContent): string | OpenAIContentPart[] {
  if (typeof content === 'string') return content

  const parts: OpenAIContentPart[] = []
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({ type: 'text', text: part.text })
      continue
    }

    if (part.type === 'image' && part.source && typeof part.source === 'object') {
      const source = part.source as { media_type?: unknown; data?: unknown }
      if (typeof source.media_type === 'string' && typeof source.data === 'string') {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${source.media_type};base64,${source.data}` },
        })
        continue
      }
    }
  }
  return parts
}

function toOpenAIMessages(request: AgentModelRequest) {
  const messages: Array<Record<string, unknown>> = [{ role: 'system', content: request.system }]
  for (const message of request.messages) {
    if (typeof message.content === 'string') {
      messages.push({ role: message.role, content: message.content })
      continue
    }

    const toolUseBlocks = message.content.filter((part) => part.type === 'tool_use')
    const toolResultBlocks = message.content.filter((part) => part.type === 'tool_result')
    if (message.role === 'assistant' && toolUseBlocks.length > 0) {
      const text = message.content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => String(part.text))
        .join('\n\n')
      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolUseBlocks.map((part) => ({
          id: String(part.id ?? ''),
          type: 'function',
          function: {
            name: String(part.name ?? ''),
            arguments: JSON.stringify(part.input ?? {}),
          },
        })),
      })
      continue
    }
    if (message.role === 'user' && toolResultBlocks.length > 0) {
      for (const part of toolResultBlocks) {
        messages.push({
          role: 'tool',
          tool_call_id: String(part.tool_use_id ?? ''),
          content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content ?? {}),
        })
      }
      continue
    }
    messages.push({ role: message.role, content: toOpenAIContent(message.content) })
  }
  return messages
}

function toOpenAITools(tools: AgentModelToolDefinition[] | undefined) {
  return tools?.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }))
}

function toAnthropicTools(request: AgentModelRequest): any[] | undefined {
  const tools: any[] = []
  if (request.webSearch) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5,
    })
  }
  if (request.tools?.length) {
    tools.push(...request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })))
  }
  return tools.length > 0 ? tools : undefined
}

function providerSetting(): AgentModelProviderName {
  const value = process.env.FREETRUST_AGENT_PROVIDER?.trim().toLowerCase()
  return value === 'openai-compatible' || value === 'self-hosted' ? 'openai-compatible' : 'anthropic'
}

class AnthropicAgentModelProvider implements AgentModelProvider {
  readonly name = 'anthropic' as const
  private client: Anthropic | null = null

  private getClient() {
    if (!this.client) {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
      this.client = new Anthropic({ apiKey: key })
    }
    return this.client
  }

  async create(request: AgentModelRequest): Promise<AgentModelResponse> {
    const tools = toAnthropicTools(request)
    const response = await this.getClient().messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages as Anthropic.Messages.MessageParam[],
      ...(tools ? { tools } : {}),
    })

    const content = response.content as unknown as Array<Record<string, unknown>>
    const toolCalls = content
      .filter((block) => block.type === 'tool_use' && typeof block.name === 'string')
      .map((block) => ({
        id: String(block.id ?? ''),
        name: String(block.name),
        input: block.input && typeof block.input === 'object' && !Array.isArray(block.input)
          ? block.input as Record<string, unknown>
          : {},
      }))

    return {
      model: request.model,
      text: textFromAnthropicContent(response.content),
      content,
      toolCalls,
      stopReason: response.stop_reason,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    }
  }

  async *stream(request: AgentModelRequest): AsyncIterable<AgentModelStreamEvent> {
    const tools = toAnthropicTools(request)
    const stream = await this.getClient().messages.stream({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages as Anthropic.Messages.MessageParam[],
      ...(tools ? { tools } : {}),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text_delta', text: event.delta.text }
      }
    }

    const finalMessage = await stream.finalMessage()
    yield {
      type: 'done',
      usage: {
        inputTokens: finalMessage.usage?.input_tokens ?? null,
        outputTokens: finalMessage.usage?.output_tokens ?? null,
      },
    }
  }
}

class OpenAICompatibleAgentModelProvider implements AgentModelProvider {
  readonly name = 'openai-compatible' as const

  private getConfig() {
    const baseUrl = process.env.FREETRUST_AGENT_BASE_URL?.trim().replace(/\/+$/, '')
    const apiKey = process.env.FREETRUST_AGENT_API_KEY?.trim()
    const model = process.env.FREETRUST_AGENT_MODEL?.trim()

    if (!baseUrl || !apiKey || !model) {
      throw new Error('FREETRUST_AGENT_BASE_URL, FREETRUST_AGENT_API_KEY, and FREETRUST_AGENT_MODEL are required for the openai-compatible provider')
    }

    return { baseUrl, apiKey, model }
  }

  private async request(request: AgentModelRequest, stream: boolean) {
    const config = this.getConfig()
    if (request.webSearch) {
      throw new Error('The openai-compatible provider does not have a web-search tool configured yet')
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: toOpenAIMessages(request),
        max_tokens: request.maxTokens,
        stream,
        ...(request.tools?.length ? { tools: toOpenAITools(request.tools), tool_choice: 'auto' } : {}),
      }),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new Error(`openai-compatible provider returned ${response.status}: ${detail}`)
    }

    return { response, config }
  }

  async create(request: AgentModelRequest): Promise<AgentModelResponse> {
    const { response, config } = await this.request(request, false)
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown; tool_calls?: Array<{ id?: unknown; function?: { name?: unknown; arguments?: unknown } }> }; finish_reason?: unknown }>
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
    }
    const message = payload.choices?.[0]?.message
    const text = typeof message?.content === 'string' ? message.content : ''
    const toolCalls = (message?.tool_calls ?? []).map((call) => {
      let input: Record<string, unknown> = {}
      if (typeof call.function?.arguments === 'string') {
        try {
          const parsed = JSON.parse(call.function.arguments)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) input = parsed as Record<string, unknown>
        } catch {
          input = {}
        }
      }
      return { id: String(call.id ?? ''), name: String(call.function?.name ?? ''), input }
    }).filter((call) => call.id && call.name)
    if (!text && toolCalls.length === 0) throw new Error('openai-compatible provider returned no text or tool response')

    const content: Array<Record<string, unknown>> = []
    if (text) content.push({ type: 'text', text })
    for (const call of toolCalls) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })

    return {
      model: config.model,
      text: text.trim(),
      content,
      toolCalls,
      stopReason: typeof payload.choices?.[0]?.finish_reason === 'string' ? payload.choices[0]?.finish_reason : null,
      usage: {
        inputTokens: typeof payload.usage?.prompt_tokens === 'number' ? payload.usage.prompt_tokens : null,
        outputTokens: typeof payload.usage?.completion_tokens === 'number' ? payload.usage.completion_tokens : null,
      },
    }
  }

  async *stream(request: AgentModelRequest): AsyncIterable<AgentModelStreamEvent> {
    const { response } = await this.request(request, true)
    if (!response.body) throw new Error('openai-compatible provider returned no stream body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens: number | null = null
    let outputTokens: number | null = null

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === '[DONE]') continue

          const payload = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: unknown } }>
            usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
          }
          const text = payload.choices?.[0]?.delta?.content
          if (typeof text === 'string' && text) yield { type: 'text_delta', text }
          if (typeof payload.usage?.prompt_tokens === 'number') inputTokens = payload.usage.prompt_tokens
          if (typeof payload.usage?.completion_tokens === 'number') outputTokens = payload.usage.completion_tokens
        }
      }
    } finally {
      reader.releaseLock()
    }

    yield { type: 'done', usage: { inputTokens, outputTokens } }
  }
}

let provider: AgentModelProvider | null = null

export function getAgentModelProvider(): AgentModelProvider {
  if (!provider) {
    provider = providerSetting() === 'openai-compatible'
      ? new OpenAICompatibleAgentModelProvider()
      : new AnthropicAgentModelProvider()
  }
  return provider
}
