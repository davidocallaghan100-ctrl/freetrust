export default function OrgSkeleton(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Cover */}
      <div className="h-72 w-full bg-gray-200" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo placeholder */}
        <div className="absolute -translate-y-1/2 w-32 h-32 rounded-2xl bg-gray-300 ml-8" />
        {/* Header */}
        <div className="mt-20 flex justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-8 bg-gray-200 rounded-lg w-64" />
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-gray-200 rounded-full w-20" />
              ))}
            </div>
          </div>
          <div className="h-10 bg-gray-200 rounded-xl w-28" />
        </div>
        {/* Content grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-16">
          <div className="lg:col-span-2 space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
                <div className="h-4 bg-gray-100 rounded w-3/5" />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 h-48" />
            <div className="bg-white rounded-2xl border border-gray-100 p-5 h-64" />
          </div>
        </div>
      </div>
    </div>
  );
}
