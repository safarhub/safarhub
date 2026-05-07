import mongoose from "mongoose";
import { mailSender } from "@/lib/utils/mailSender";
import emailVerificationTemplate from "@/lib/mail/templates/emailVerificationTemplate";

function maskEmail(email: string) {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) return "[invalid-email]";

  const maskedLocal =
    localPart.length <= 2
      ? `${localPart[0] || "*"}*`
      : `${localPart[0]}***${localPart[localPart.length - 1]}`;

  return `${maskedLocal}@${domainPart}`;
}

const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5 min TTL
});

OTPSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      await mailSender(
        this.email,
        "Your OTP",
        emailVerificationTemplate(this.otp)
      );
      console.log(`OTP email sent to ${maskEmail(this.email)}`);
    } catch (error) {
      console.error("❌ Email sending failed:", error);

      if (process.env.NODE_ENV === "production") {
        return next(error as Error);
      }

      console.warn("Continuing without email delivery in non-production environment");
    }
  }
  next();
});

export default mongoose.models.OTP || mongoose.model("OTP", OTPSchema);