import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-8xl font-bold text-pink mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-dark mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-medium mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back to shopping!
        </p>
        <Link
          href="/"
          className="inline-block bg-pink text-white px-8 py-3 rounded-full hover:bg-pink-dark transition-colors font-medium"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
