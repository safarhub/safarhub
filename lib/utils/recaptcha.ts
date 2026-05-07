type VerifyRecaptchaParams = {
  token: string;
  expectedAction: string;
  remoteIp?: string;
};

type VerifyRecaptchaResult = {
  success: boolean;
  message?: string;
};

type RecaptchaVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export async function verifyRecaptcha({
  token,
  expectedAction,
  remoteIp,
}: VerifyRecaptchaParams): Promise<VerifyRecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return { success: false, message: "reCAPTCHA server key is missing" };
  }

  if (!token) {
    return { success: false, message: "Missing reCAPTCHA token" };
  }

  try {
    const formData = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp) {
      formData.set("remoteip", remoteIp);
    }

    const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
      cache: "no-store",
    });

    if (!verifyResponse.ok) {
      return { success: false, message: "Unable to verify reCAPTCHA" };
    }

    const verification = (await verifyResponse.json()) as RecaptchaVerifyResponse;

    if (!verification.success) {
      return { success: false, message: "reCAPTCHA verification failed" };
    }

    if (verification.action && verification.action !== expectedAction) {
      return { success: false, message: "Invalid reCAPTCHA action" };
    }

    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
    if (typeof verification.score === "number" && verification.score < minScore) {
      return { success: false, message: "reCAPTCHA score too low" };
    }

    return { success: true };
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return { success: false, message: "reCAPTCHA verification error" };
  }
}