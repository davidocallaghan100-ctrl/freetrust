import Link from "next/link";

export default function NotFound(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Organisation Not Found</h2>
        <p className="text-gray-500 mb-8">
          The organisation you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
