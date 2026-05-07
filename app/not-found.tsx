import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-black">404</h1>
        <p className="mt-3 text-lg text-black">This page could not be found.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
