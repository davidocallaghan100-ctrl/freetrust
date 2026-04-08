import { CheckBadgeIcon } from "@heroicons/react/24/solid";

export default function VerifiedBadge(): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold"
      title="Verified Organisation"
    >
      <CheckBadgeIcon className="w-4 h-4 text-blue-500" />
      Verified
    </span>
  );
}
