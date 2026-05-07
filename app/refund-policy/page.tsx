import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | SafarHub",
  description: "SafarHub Refund and Cancellation Policy",
  alternates: {
    canonical: "https://www.safarhub.in/refund-policy",
  },
};

const refundPolicyText = `REFUND POLICY
General Principle
Refunds are not automatic and shall be governed strictly by this Agreement, applicable Partner policies, and Applicable Law.

Non-Refundable Situations
Unless expressly stated otherwise, refunds shall not be issued for:
Change of mind or personal preference
Partial use of services
Delays or disruptions caused by force majeure events
Services rendered by third-party Partners in accordance with their stated terms
Promotional, discounted, or reward-based services

Conditional Refunds
Where refunds are permitted, they shall be subject to:
Verification of the claim
Applicable cancellation timelines
Deduction of service fees, processing charges, or statutory levies
Refunds, if approved, shall be processed within a reasonable period, subject to the payment provider's timelines.

Platform Limitation
The Platform acts primarily as a facilitator. Refund obligations arising from third-party services shall be subject to the respective Partner's refund policy, unless otherwise mandated by law.

CANCELLATION, & PENALTY POLICY
(Compliant with Consumer Protection Act 2019, Indian Contract Act 1872 & RBI Guidelines)

Free Cancellation (Cooling-Off Period)
User Entitlement: Any User may cancel a confirmed booking at no charge within 45(Forty-five) days of booking confirmation, provided the tour/service has not commenced.

Cancellations Beyond 24 Hours (Service-Linked Penalties Apply)
Cancellations requested after the initial 24-hour cooling-off period shall be subject to the following penalty structure:
Cancellation Timeline | Penalty Applicable | Refund Calculation | Conditions
After 45 days before Service Commencement, 15% of the booking value, 85% refunded, Administrative costs + resource allocation
45-30 days before Service Commencement, 35% of booking value, 65% refunde, Partner coordination + slot loss
After 30- 7 days No-Show (no prior cancellation), 100% penalty (no refund), Zero refund, Full service cost borne by Platform & Partner

Cancellation Request Protocol
Method: All cancellations must be submitted through the Platform's dedicated cancellation interface or customer support portal
Confirmation: The User shall receive a cancellation acknowledgment with a timestamp within 24 hours
Verification Period: The Platform reserves the right to verify cancellation eligibility within 24 hours (e.g., service not already commenced, User identity confirmation)
Processing Timeline: Upon verification, the Platform shall initiate refund processing within 5 business days

Contact Us
If you have any questions about this Refund and Cancellation Policy, please contact us at:

Email: safarhub1@gmail.com

Phone: +91 8240519110

Address: Kolkata, India`;

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto mt-24 max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900">Refund and Cancellation Policy</h1>
        <pre className="mt-6 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-gray-800">
          {refundPolicyText}
        </pre>
      </section>
    </main>
  );
}
