import crypto from "crypto";

export function verifyRazorpayPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret: string;
}) {
  const payload = params.razorpayOrderId + "|" + params.razorpayPaymentId;

  const expected = crypto
    .createHmac("sha256", params.secret)
    .update(payload)
    .digest("hex");

  return expected === params.razorpaySignature;
}

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
  secret: string;
}) {
  const expected = crypto
    .createHmac("sha256", params.secret)
    .update(params.rawBody)
    .digest("hex");

  return expected === params.signature;
}