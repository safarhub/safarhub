export type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = async () => {
  if (typeof window !== "undefined" && window.Razorpay) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const openRazorpayCheckout = async (params: {
  key: string;
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  localOrderId: string;
  prefillName: string;
  prefillContact: string;
  themeColor?: string;
}) => {
  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded || !window.Razorpay) {
    throw new Error("Unable to load Razorpay checkout. Please try again.");
  }

  return await new Promise<RazorpayPaymentResponse>((resolve, reject) => {
    const paymentObject = new window.Razorpay({
      key: params.key,
      amount: params.amount,
      currency: params.currency,
      name: "Safar Hub",
      description: params.description,
      order_id: params.orderId,
      prefill: {
        name: params.prefillName,
        contact: params.prefillContact,
      },
      notes: {
        localOrderId: params.localOrderId,
      },
      handler: (response: RazorpayPaymentResponse) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      theme: {
        color: params.themeColor || "#16a34a",
      },
    });

    paymentObject.on("payment.failed", (response: any) => {
      reject(new Error(response?.error?.description || "Payment failed"));
    });

    paymentObject.open();
  });
};

export const verifyRazorpayPayment = async (
  localOrderId: string,
  paymentResponse: RazorpayPaymentResponse
) => {
  const verifyRes = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      localOrderId,
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature,
    }),
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData?.success) {
    throw new Error(verifyData?.message || "Payment verification failed");
  }
};
