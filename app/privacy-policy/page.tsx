import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | SafarHub",
  description: "SafarHub Privacy Policy",
  alternates: {
    canonical: "https://www.safarhub.in/privacy-policy",
  },
};

const privacyPolicyText = `DATA COLLECTION, RECORD RETENTION & USER RIGHTS
Compliance with Data Protection Laws
The Platform shall collect, process, store, and retain User data in accordance with applicable laws, including:
Digital Personal Data Protection Act, 2023 (DPDP Act)
Information Technology Act, 2000, and related rules
Applicable Consumer Protection laws (Consumer Protection Act, 2019, Consumer Protection (E-Commerce) Rules, 2020)

Purpose Limitation & Non-Sale of Data
User data shall be collected solely for lawful purposes, including identity verification, safety compliance, transaction processing, analytics, fraud prevention, and regulatory compliance. The Platform does not sell personal data to third parties.

Record Retention
Transaction records, identity verification logs, and relevant user activity data may be retained for a reasonable period as required for safety, dispute resolution, legal compliance, and audit purposes.

RECORD RETENTION & AUDIT RIGHTS
Record Maintenance
The Platform may maintain records of:
User registrations and identity verification
Transactions and communications
Content submissions and moderation actions
Safety incidents and complaints
Such records may be retained for lawful purposes, including audits, investigations, dispute resolution, and regulatory compliance.

Audit & Disclosure
The Platform may disclose records to governmental, regulatory, or judicial authorities where required by law or in good-faith compliance.

Contact Us
If you have any questions about this Privacy Policy, please contact us at:

Email: safarhub1@gmail.com

Phone: +91 8240519110

Address: Kolkata, India`;

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto mt-24 max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <pre className="mt-6 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-gray-800">
          {privacyPolicyText}
        </pre>
      </section>
    </main>
  );
}
