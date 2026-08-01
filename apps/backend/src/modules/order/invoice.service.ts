import type { UserRole } from '@prisma/client';

import { getOrderById } from './order.service';

// Feature 7 Task 8 — Gap #2's Assumption: an invoice is a derived, on-demand render, never a
// persisted entity (no new table/migration). Reuses getOrderById entirely — zero direct Prisma
// calls in this file (grep-audited in the test suite).
//
// No PDF library exists anywhere in this codebase yet; adding one for a single on-demand
// document would be a genuinely new dependency for one feature's convenience. Rendered as
// print-friendly HTML instead (the module doc's own explicit fallback for exactly this case) —
// the browser's native "Print to PDF" produces the PDF a buyer/seller actually wants, with zero
// new dependencies.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generateInvoiceHtml(
  orderPublicId: string,
  requester: { userId: bigint; role: UserRole },
): Promise<string> {
  const order = await getOrderById(orderPublicId, requester);

  // Task 8.2 — commission is excluded from the invoice for every role, regardless of what
  // getOrderById returned (stricter than Order Detail's seller-only commission visibility) —
  // an invoice is treated as an external-facing financial document. Flagged as this playbook's
  // own interpretation, not a sourced requirement (see the handoff doc).
  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.titleSnapshot)}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">${item.unitPrice}</td>
          <td style="text-align:right">${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice — Order ${escapeHtml(order.id)}</title>
<style>
  body { font-family: sans-serif; padding: 2rem; color: #111; }
  h1 { font-size: 1.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { padding: 0.5rem; border-bottom: 1px solid #ddd; }
  th { text-align: left; background: #f5f5f5; }
  .totals td { border: none; padding: 0.25rem 0.5rem; }
  .totals .label { text-align: right; font-weight: 600; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Invoice — Order ${escapeHtml(order.id)}</h1>
  <p>Placed: ${escapeHtml(order.placedAt)}</p>
  <p>Payment: ${escapeHtml(order.paymentMethod)} (${escapeHtml(order.paymentStatus)})</p>
  <h2>Shipping to</h2>
  <p>
    ${escapeHtml(order.shipping.recipientName)}<br>
    ${escapeHtml(order.shipping.line1)}${order.shipping.line2 ? `, ${escapeHtml(order.shipping.line2)}` : ''}<br>
    ${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.province)}${order.shipping.postalCode ? ` ${escapeHtml(order.shipping.postalCode)}` : ''}<br>
    ${escapeHtml(order.shipping.phone)}
  </p>
  <table>
    <thead>
      <tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Line Total</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td>${escapeHtml(order.subtotal)}</td></tr>
    <tr><td class="label">Shipping</td><td>${escapeHtml(order.shippingFee)}</td></tr>
    <tr><td class="label">Total</td><td><strong>${escapeHtml(order.totalAmount)}</strong></td></tr>
  </table>
</body>
</html>`;
}
