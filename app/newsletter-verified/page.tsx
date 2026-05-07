import React from "react";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";

export default async function NewsletterVerified({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const isSuccess = resolvedSearchParams.success === "true";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        {isSuccess ? (
          <>
            <FaCheckCircle className="text-6xl text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Email Verified!
            </h1>
            <p className="text-gray-600 mb-6">
              Thank you for confirming your subscription. You'll now receive our
              latest updates and offers.
            </p>
            <Link
              href="/"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
            >
              Back to Home
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verification Failed
            </h1>
            <p className="text-gray-600 mb-6">
              The verification link is invalid or has expired. Please try
              subscribing again.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            >
              Back to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
