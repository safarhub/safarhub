// lib/mail/templates/assignedCouponTemplate.ts

interface AssignedCouponTemplateProps {
  recipientName: string;
  recipientEmail: string;
  couponCode: string;
  discountType: "percentage" | "fixed";
  discountAmount: number;
  minPurchase: number;
  maxDiscount?: number;
  expiryDate: Date;
  adminNote?: string;
}

export default function assignedCouponTemplate({
  recipientName,
  couponCode,
  discountType,
  discountAmount,
  minPurchase,
  maxDiscount,
  expiryDate,
  adminNote,
}: AssignedCouponTemplateProps): string {
  const discountLabel =
    discountType === "percentage"
      ? `${discountAmount}% OFF`
      : `₹${discountAmount} OFF`;

  const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const maxDiscountNote =
    discountType === "percentage" && maxDiscount
      ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Maximum discount: ₹${maxDiscount}</p>`
      : "";

  const minPurchaseNote =
    minPurchase > 0
      ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Valid on orders above ₹${minPurchase}</p>`
      : "";

  const adminNoteSection = adminNote
    ? `<div style="margin:24px 0 0;padding:16px 20px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:14px;color:#15803d;font-style:italic;">"${adminNote}"</p>
        <p style="margin:6px 0 0;font-size:12px;color:#4ade80;">— SafarHub Team</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Exclusive SafarHub Coupon</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#166534 0%,#16a34a 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                🎁 SafarHub
              </h1>
              <p style="margin:8px 0 0;font-size:15px;color:#bbf7d0;font-weight:500;">
                You've received an exclusive coupon!
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
                Hi <strong style="color:#111827;">${recipientName || "there"}</strong> 👋,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
                The SafarHub team has assigned you a special discount coupon, exclusively for you. 
                This is a <strong style="color:#111827;">one-time use</strong> coupon valid only for your account.
              </p>

              <!-- Coupon Card -->
              <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px dashed #16a34a;border-radius:16px;padding:28px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1.5px;">
                  Your Coupon Code
                </p>
                <div style="background:#ffffff;border:1.5px solid #86efac;border-radius:10px;padding:14px 24px;display:inline-block;margin:0 0 16px;">
                  <span style="font-size:28px;font-weight:900;color:#15803d;font-family:'Courier New',monospace;letter-spacing:4px;">
                    ${couponCode}
                  </span>
                </div>
                <div style="background:#16a34a;color:#ffffff;font-size:22px;font-weight:800;padding:10px 28px;border-radius:50px;display:inline-block;letter-spacing:-0.5px;">
                  ${discountLabel}
                </div>
                ${minPurchaseNote}
                ${maxDiscountNote}
              </div>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 24px;">
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 20px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">
                    VALIDITY
                  </td>
                  <td style="padding:12px 20px;font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;text-align:right;">
                    Until ${formattedExpiry}
                  </td>
                </tr>
                <tr style="background:#ffffff;">
                  <td style="padding:12px 20px;font-size:13px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">
                    USAGE
                  </td>
                  <td style="padding:12px 20px;font-size:13px;color:#111827;font-weight:700;border-bottom:1px solid #e5e7eb;text-align:right;">
                    One-time use only
                  </td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 20px;font-size:13px;color:#6b7280;font-weight:600;">
                    ASSIGNED TO
                  </td>
                  <td style="padding:12px 20px;font-size:13px;color:#111827;font-weight:700;text-align:right;">
                    Your account only
                  </td>
                </tr>
              </table>

              ${adminNoteSection}

              <!-- CTA -->
              <div style="text-align:center;margin:32px 0 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://safarhub.com"}" 
                   style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(22,163,74,0.35);">
                  🧳 Book Now &amp; Save
                </a>
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
                  Apply code <strong>${couponCode}</strong> at checkout
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This coupon is exclusively assigned to your email and can only be used once.<br/>
                It cannot be transferred, shared, or used by another account.<br/><br/>
                © ${new Date().getFullYear()} SafarHub. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}