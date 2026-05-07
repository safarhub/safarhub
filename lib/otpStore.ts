// In-memory OTP store for admin password change
// NOTE: This works for single-instance deployments.
// For multi-instance deployments (like Vercel), replace with Redis or database storage.

export type OtpData = {
  otp: string;
  expiresAt: number;
};

// Key: "admin_otp", Value: { otp, expiresAt }
export const otpStore = new Map<string, OtpData>();

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
