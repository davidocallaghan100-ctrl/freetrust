import { ShieldCheckIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";

interface TrustScoreBadgeProps {
  score: number;
  totalReviews: number;
  isVerified: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-amber-500";
  return "text-rose-500";
}

function getScoreBg(score: number): string {
  if (score >= 8) return "from-emerald-50 to-green-50 border-emerald-200";
  if (score >= 6) return "from-amber-50 to-yellow-50 border-amber-200";
  return "from-rose-50 to-red-50 border-rose-200";
}

function getScoreLabel(score: number): string {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Very Good";
  if (score >= 6) return "Good";
  if (score >= 4) return "Fair";
  return "Poor";
}

function ScoreArc({ score }: { score: number }): JSX.Element {
  const radius = 40;
  const circumference = Math.PI * radius;
  const progress = (score / 10) * circumference;
  const strokeDashoffset = circumference - progress;

  return (
    <svg width="100" height="60" className="overflow-visible">
      <path
        d={`M 10 55 A ${radius} ${radius} 0 0 1 90 55`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M 10 55 A ${radius} ${radius} 0 0 1 90 55`}
        fill="none"
        stroke={score >= 8 ? "#10b981" : score >= 6 ? "#f59e0b" : "#f43f5e"}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${strokeDashoffset}`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

export default function TrustScoreBadge({ score, totalReviews, isVerified }: TrustScoreBadgeProps): JSX.Element {
  return (
    <div className={`bg-gradient-to-br ${getScoreBg(score)} border rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900">FreeTrust Score</h3>
      </div>

      <div className="flex flex-col items-center mb-4">
        <ScoreArc score={score} />
        <div className="-mt-2 text-center">
          <span className={`text-4xl font-black ${getScoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-gray-400 text-sm font-medium">/10</span>
          <p className={`text-sm font-semibold mt-0.5 ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </p>
        </div>
      </div>

      <p className="text-xs text-center text-gray-500 mb-4">
        Based on {totalReviews.toLocaleString()} verified reviews
      </p>

      {isVerified && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <CheckBadgeIcon className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-900">Verified Organisation</p>
            <p className="text-xs text-blue-600 leading-tight">
              Identity and legitimacy confirmed by FreeTrust
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
