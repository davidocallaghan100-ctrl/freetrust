import type { SupabaseClient } from '@supabase/supabase-js'

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'
export const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_MESSAGE_ATTACHMENTS = 5

export const ALLOWED_MESSAGE_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

export interface MessageAttachment {
  url: string
  type: string
  name: string
  size: number
}

export function isImageAttachment(attachment: Pick<MessageAttachment, 'type'>): boolean {
  return attachment.type.startsWith('image/')
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function validateMessageAttachmentFiles(files: File[], existingCount = 0): string | null {
  if (existingCount + files.length > MAX_MESSAGE_ATTACHMENTS) {
    return `You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files per message.`
  }

  for (const file of files) {
    if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
      return `${file.name} is too large. The limit is 10 MB per file.`
    }
    if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.has(file.type)) {
      return `${file.name} is not a supported file type.`
    }
  }

  return null
}

function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  return cleaned || 'attachment'
}

export async function uploadMessageAttachments(
  supabase: SupabaseClient,
  files: File[],
  options: { userId: string; conversationId: string },
): Promise<MessageAttachment[]> {
  const validationError = validateMessageAttachmentFiles(files)
  if (validationError) throw new Error(validationError)

  const uploaded: MessageAttachment[] = []

  for (const file of files) {
    const path = `${options.userId}/${options.conversationId}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`
    const { error } = await supabase.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      throw new Error(`Could not upload ${file.name}: ${error.message}`)
    }

    uploaded.push({
      url: path,
      type: file.type,
      name: file.name,
      size: file.size,
    })
  }

  return uploaded
}

export function normalizeMessageAttachments(input: unknown): MessageAttachment[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item): MessageAttachment[] => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Partial<MessageAttachment>
    if (typeof raw.url !== 'string' || typeof raw.type !== 'string' || typeof raw.name !== 'string') return []
    const size = typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : 0
    return [{ url: raw.url, type: raw.type, name: raw.name, size }]
  })
}
