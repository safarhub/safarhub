import React from "react";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";

export default async function NewsletterUnsubscribed({
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
            <FaCheckCircle className="text-6xl text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Unsubscribed
            </h1>
            <p className="text-gray-600 mb-6">
              You have been successfully unsubscribed from our newsletter. We're
              sorry to see you go!
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            >
              Back to Home
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Unsubscribe Failed
            </h1>
            <p className="text-gray-600 mb-6">
              Something went wrong. Please try again or contact support.
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
