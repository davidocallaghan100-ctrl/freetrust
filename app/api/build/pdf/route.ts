export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { spendTrustCoins } from '@/lib/build/spend'
import { PDF_COST, DISCLAIMER_TEXT, BUILD_SECTIONS, type DesignSpec } from '@/lib/build/spec'

const MARGIN = 50
const PAGE_W = 595.28 // A4 pt
const PAGE_H = 841.89
const CONTENT_W = PAGE_W - MARGIN * 2

// pdf-lib's StandardFonts (Helvetica/HelveticaBold) only support WinAnsi
// encoding. Claude-generated content and section icons routinely include
// emoji (🏗️, ⚠️, etc.) and other characters outside that set, which throw
// at draw time. Strip anything the font can't encode instead of crashing
// mid-generation (which would leave Trust Coins spent with no PDF produced).
function sanitizeForFont(text: string, font: import('pdf-lib').PDFFont): string {
  let out = ''
  for (const ch of text) {
    if (ch === '\n' || ch === '\t') {
      out += ' '
      continue
    }
    try {
      font.widthOfTextAtSize(ch, 10)
      out += ch
    } catch {
      // unencodable (emoji, exotic symbols) — drop silently
    }
  }
  return out
}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\r/g, '').split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// POST /api/build/pdf  body: { conversationId: string }
// Charges PDF_COST (15 TC) via spend_trust BEFORE generating the file.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as { conversationId?: string } | null
    const conversationId = body?.conversationId
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: conversation } = await admin
      .from('build_conversations')
      .select('id, title')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const [{ data: messages }, { data: sections }] = await Promise.all([
      admin.from('build_messages')
        .select('design_spec, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20),
      admin.from('build_sections')
        .select('section_key, content, generated_at')
        .eq('conversation_id', conversationId),
    ])

    const latestSpec = (messages?.find(m => m.design_spec)?.design_spec ?? null) as DesignSpec | null
    if (!latestSpec && !(sections && sections.length)) {
      return NextResponse.json({ error: 'Nothing to export yet — generate a design first.' }, { status: 400 })
    }

    // Charge BEFORE generating.
    const spend = await spendTrustCoins(user.id, PDF_COST, 'spend_build_pdf', 'Build: download building steps PDF')
    if (!spend.ok) {
      if (spend.code === 'insufficient_funds') {
        return NextResponse.json(
          { error: 'Insufficient trust balance', code: 'insufficient_funds', balance: spend.balance, required: spend.required },
          { status: 402 }
        )
      }
      return NextResponse.json({ error: spend.message }, { status: 500 })
    }

    // ── Build the PDF ────────────────────────────────────────────────
    // Wrapped separately so any generation failure can refund the coins
    // already charged above — a user should never lose Trust Coins for a
    // PDF that was never delivered.
    try {
      const pdf = await PDFDocument.create()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

      let page = pdf.addPage([PAGE_W, PAGE_H])
      let y = PAGE_H - MARGIN

      const teal = rgb(0.07, 0.6, 0.55)
      const dark = rgb(0.06, 0.1, 0.14)
      const grey = rgb(0.4, 0.44, 0.48)
      const amber = rgb(0.75, 0.4, 0.05)

      const ensureSpace = (need: number) => {
        if (y - need < MARGIN) {
          page = pdf.addPage([PAGE_W, PAGE_H])
          y = PAGE_H - MARGIN
        }
      }

      const drawHeading = (text: string, size = 16) => {
        const clean = sanitizeForFont(text, bold).trim()
        if (!clean) return
        ensureSpace(size + 14)
        page.drawText(clean, { x: MARGIN, y, size, font: bold, color: teal })
        y -= size + 10
      }

      const drawSubheading = (text: string, size = 12) => {
        const clean = sanitizeForFont(text, bold).trim()
        if (!clean) return
        ensureSpace(size + 10)
        page.drawText(clean, { x: MARGIN, y, size, font: bold, color: dark })
        y -= size + 6
      }

      const drawParagraph = (text: string, size = 10, color = dark, lineGap = 4) => {
        const clean = sanitizeForFont(text, font)
        const lines = wrapText(clean, font, size, CONTENT_W)
        for (const line of lines) {
          if (!line.trim()) continue
          ensureSpace(size + lineGap)
          page.drawText(line, { x: MARGIN, y, size, font, color })
          y -= size + lineGap
        }
        y -= 4
      }

      // Title
      page.drawText(sanitizeForFont('FreeTrust — Build', bold), { x: MARGIN, y, size: 20, font: bold, color: teal })
      y -= 28
      page.drawText(sanitizeForFont(conversation.title || latestSpec?.name || 'Untitled design', bold), { x: MARGIN, y, size: 15, font: bold, color: dark })
      y -= 20
      page.drawText(new Date().toLocaleDateString('en-IE', { year: 'numeric', month: 'long', day: 'numeric' }), { x: MARGIN, y, size: 9, font, color: grey })
      y -= 20

      // Disclaimer box
      ensureSpace(50)
      page.drawRectangle({ x: MARGIN, y: y - 40, width: CONTENT_W, height: 40, color: rgb(0.98, 0.95, 0.88) })
      const disclaimerLines = wrapText(sanitizeForFont(DISCLAIMER_TEXT, font), font, 8.5, CONTENT_W - 16)
      let dy = y - 12
      for (const line of disclaimerLines) {
        page.drawText(line, { x: MARGIN + 8, y: dy, size: 8.5, font, color: amber })
        dy -= 11
      }
      y -= 52

      // Design snapshot
      if (latestSpec) {
        drawHeading('Design Snapshot')
        drawParagraph(`Name: ${latestSpec.name}`)
        drawParagraph(`Footprint: ${latestSpec.footprint.width_m}m x ${latestSpec.footprint.depth_m}m`)
        drawParagraph(`Storeys: ${latestSpec.storeys} (storey height ${latestSpec.storey_height_m}m)`)
        drawParagraph(`Roof: ${latestSpec.roof.type}${latestSpec.roof.pitch_deg ? ` at ${latestSpec.roof.pitch_deg} degrees` : ''}`)
        if (latestSpec.materials_palette?.length) {
          drawParagraph(`Materials: ${latestSpec.materials_palette.map(m => m.material).join(', ')}`)
        }
      }

      // Ordered sections: core first (brief, design, build_sequence), then any generated on-demand ones.
      const sectionMap = new Map((sections ?? []).map(s => [s.section_key, s.content]))
      for (const meta of BUILD_SECTIONS) {
        const content = sectionMap.get(meta.key)
        if (!content) continue
        drawHeading(meta.label, 14)
        drawParagraph(content, 10)
      }

      // Trailing disclaimer repeat
      ensureSpace(60)
      y -= 6
      drawSubheading('Important', 11)
      drawParagraph(DISCLAIMER_TEXT, 9, amber)

      const pdfBytes = await pdf.save()

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="freetrust-build-${conversationId.slice(0, 8)}.pdf"`,
          'X-New-Balance': String(spend.newBalance ?? ''),
        },
      })
    } catch (genErr) {
      console.error('[POST /api/build/pdf] generation failed after charge — refunding', genErr)
      const { error: refundErr } = await admin.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: PDF_COST,
        p_type: 'refund_build_pdf',
        p_ref: null,
        p_desc: 'Build: PDF generation failed — refund',
      })
      if (refundErr) {
        console.error('[POST /api/build/pdf] refund also failed', refundErr)
      }
      return NextResponse.json({
        error: 'PDF generation failed — your Trust Coins have been refunded. Please try again.',
        refunded: !refundErr,
      }, { status: 500 })
    }
  } catch (err) {
    console.error('[POST /api/build/pdf] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error generating PDF' }, { status: 500 })
  }
}
