export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FEE_RATE_SERVICE = 0.08
const FEE_RATE_PRODUCT = 0.05
const VAT_RATE = 0.23

function euroFormat(cents: number): string {
  return '€' + (cents / 100).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Draw a horizontal rule
function drawRule(page: ReturnType<PDFDocument['addPage']>, y: number, color: [number, number, number] = [0.18, 0.22, 0.31]) {
  page.drawLine({
    start: { x: 50, y },
    end:   { x: 545, y },
    thickness: 0.5,
    color: rgb(...color),
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only the seller can download the invoice
    if (order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only for completed/delivered orders
    if (order.status !== 'completed' && order.status !== 'delivered') {
      return NextResponse.json({ error: 'Invoice only available for completed orders' }, { status: 400 })
    }

    // Fetch seller and buyer profiles
    const [{ data: sellerProfile }, { data: buyerProfile }] = await Promise.all([
      admin.from('profiles').select('full_name, email, vat_registered, vat_number').eq('id', order.seller_id).maybeSingle(),
      admin.from('profiles').select('full_name, email').eq('id', order.buyer_id).maybeSingle(),
    ])

    // Assign invoice number if not yet set
    let invoiceNumber = order.invoice_number as string | null
    if (!invoiceNumber) {
      const { data: numData } = await admin.rpc('generate_invoice_number')
      invoiceNumber = numData as string
      if (invoiceNumber) {
        await admin.from('orders').update({ invoice_number: invoiceNumber }).eq('id', id)
      } else {
        invoiceNumber = `FT-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`
      }
    }

    // Fee calc
    const totalCents = Number(order.amount ?? 0)
    const itemType   = String(order.type ?? '').toLowerCase()
    const feeRate    = itemType === 'product' ? FEE_RATE_PRODUCT : FEE_RATE_SERVICE
    const feePct     = itemType === 'product' ? 5 : 8
    const feeCents   = Math.round(totalCents * feeRate)
    const netCents   = totalCents - feeCents
    const isVat      = sellerProfile?.vat_registered === true
    const vatCents   = isVat ? Math.round(netCents * VAT_RATE) : 0
    const totalWithVat = netCents + vatCents

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const doc  = await PDFDocument.create()
    const page = doc.addPage([595, 842]) // A4

    const boldFont   = await doc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await doc.embedFont(StandardFonts.Helvetica)

    const WHITE  = rgb(0.97, 0.98, 0.99)
    const GREEN  = rgb(0.06, 0.73, 0.51)
    const GRAY   = rgb(0.44, 0.51, 0.60)
    const DARK   = rgb(0.09, 0.13, 0.21)
    const RED    = rgb(0.97, 0.44, 0.44)
    const BGDARK = rgb(0.09, 0.13, 0.21)

    // Header background
    page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: BGDARK })

    // FreeTrust brand name
    page.drawText('FreeTrust', {
      x: 50, y: 798,
      size: 22, font: boldFont, color: GREEN,
    })
    page.drawText('freetrust.co', {
      x: 50, y: 781,
      size: 9, font: regularFont, color: GRAY,
    })

    // TAX INVOICE title (right side)
    page.drawText('TAX INVOICE', {
      x: 390, y: 804,
      size: 16, font: boldFont, color: WHITE,
    })
    page.drawText(`Invoice #: ${invoiceNumber}`, {
      x: 390, y: 789,
      size: 8.5, font: regularFont, color: GRAY,
    })
    const invoiceDate = new Date(order.created_at as string)
    page.drawText(`Date: ${invoiceDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
      x: 390, y: 778,
      size: 8.5, font: regularFont, color: GRAY,
    })

    let y = 745

    // Seller / Buyer blocks
    // Seller (left)
    page.drawText('FROM (Seller)', {
      x: 50, y, size: 8, font: boldFont, color: GRAY,
    })
    page.drawText('TO (Buyer)', {
      x: 310, y, size: 8, font: boldFont, color: GRAY,
    })
    y -= 14
    page.drawText(sellerProfile?.full_name || 'Seller', {
      x: 50, y, size: 11, font: boldFont, color: WHITE,
    })
    page.drawText(buyerProfile?.full_name || 'Buyer', {
      x: 310, y, size: 11, font: boldFont, color: WHITE,
    })
    y -= 14
    if (sellerProfile?.email) {
      page.drawText(sellerProfile.email, { x: 50, y, size: 9, font: regularFont, color: GRAY })
    }
    if (buyerProfile?.email) {
      page.drawText(buyerProfile.email, { x: 310, y, size: 9, font: regularFont, color: GRAY })
    }
    if (isVat && sellerProfile?.vat_number) {
      y -= 13
      page.drawText(`VAT No: ${sellerProfile.vat_number}`, { x: 50, y, size: 9, font: regularFont, color: GRAY })
    }

    y -= 22
    drawRule(page, y)
    y -= 18

    // Line items table header
    page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 18, color: rgb(0.12, 0.17, 0.27) })
    page.drawText('Description', { x: 56, y: y, size: 8.5, font: boldFont, color: GRAY })
    page.drawText('Qty', { x: 370, y: y, size: 8.5, font: boldFont, color: GRAY })
    page.drawText('Unit Price', { x: 410, y: y, size: 8.5, font: boldFont, color: GRAY })
    page.drawText('Amount', { x: 490, y: y, size: 8.5, font: boldFont, color: GRAY })
    y -= 22

    // Line item row
    const itemTitle = String(order.title ?? 'Item')
    // Truncate long titles
    const displayTitle = itemTitle.length > 55 ? itemTitle.slice(0, 52) + '...' : itemTitle
    page.drawText(displayTitle, { x: 56, y, size: 10, font: regularFont, color: WHITE })
    page.drawText('1', { x: 375, y, size: 10, font: regularFont, color: WHITE })
    page.drawText(euroFormat(totalCents), { x: 410, y, size: 10, font: regularFont, color: WHITE })
    page.drawText(euroFormat(totalCents), { x: 490, y, size: 10, font: regularFont, color: WHITE })
    y -= 12

    // Item type badge
    page.drawText(`Type: ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`, {
      x: 56, y, size: 8, font: regularFont, color: GRAY,
    })
    page.drawText(`Ref: ${id.slice(0, 8).toUpperCase()}`, {
      x: 200, y, size: 8, font: regularFont, color: GRAY,
    })
    y -= 20

    drawRule(page, y)
    y -= 18

    // Totals section
    const drawRow = (label: string, value: string, labelColor = GRAY, valueColor = WHITE, bold = false) => {
      page.drawText(label, { x: 350, y, size: 9.5, font: bold ? boldFont : regularFont, color: labelColor })
      page.drawText(value, { x: 490, y, size: 9.5, font: bold ? boldFont : regularFont, color: valueColor })
      y -= 16
    }

    drawRow('Subtotal', euroFormat(totalCents))
    drawRow(`Platform fee (${feePct}%)`, `−${euroFormat(feeCents)}`, GRAY, RED)

    if (isVat) {
      drawRow('Net before VAT', euroFormat(netCents))
      drawRow('VAT (23%)', euroFormat(vatCents))
    }

    y -= 4
    drawRule(page, y, [0.06, 0.73, 0.51])
    y -= 20

    // Net payout (bold green)
    page.drawText(isVat ? 'Total (incl. VAT)' : 'Net Payout', {
      x: 350, y, size: 12, font: boldFont, color: GREEN,
    })
    page.drawText(euroFormat(totalWithVat), {
      x: 490, y, size: 12, font: boldFont, color: GREEN,
    })

    y -= 35
    drawRule(page, y)
    y -= 20

    // Footer
    page.drawText('Payment processed securely via FreeTrust Escrow', {
      x: 50, y, size: 9, font: regularFont, color: GRAY,
    })
    y -= 14
    page.drawText(`Order Reference: ${id}`, { x: 50, y, size: 8.5, font: regularFont, color: GRAY })
    y -= 14
    page.drawText('This document serves as a valid sales receipt. For VAT queries contact support@freetrust.co', {
      x: 50, y, size: 7.5, font: regularFont, color: rgb(0.36, 0.42, 0.52),
    })

    const pdfBytes = await doc.save()
    const pdfBuffer = Buffer.from(pdfBytes)

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[GET /api/orders/[id]/invoice]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
