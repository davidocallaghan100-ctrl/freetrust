"use client";

import { useState } from "react";
import Image from "next/image";
import { Review } from "@/types/organisation";
import { StarIcon, ChatBubbleLeftEllipsisIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
import { StarIcon as StarOutlineIcon } from "@heroicons/react/24/outline";

interface OrgReviewsProps {
  reviews: Review[];
  trustScore: number;
  totalReviews: number;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }): JSX.Element {
  const sizeClass = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) =>
        star <= rating ? (
          <StarIcon key={star} className={`${sizeClass} text-amber-400`} />
        ) : (
          <StarOutlineIcon key={star} className={`${sizeClass} text-gray-300`} />
        )
      )}
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function OrgReviews({ reviews, trustScore, totalReviews }: OrgReviewsProps): JSX.Element {
  const [showAll, setShowAll] = useState<boolean>(false);
  const displayedReviews = showAll ? reviews : reviews.slice(0, 2);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-indigo-500" />
          Reviews
        </h2>
        <span className="text-sm text-gray-500">{totalReviews.toLocaleString()} total</span>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{trustScore.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Trust Score</p>
        </div>
        <div className="h-10 w-px bg-amber-200" />
        <div>
          <StarRating rating={Math.round(trustScore / 2)} size="md" />
          <p className="text-xs text-gray-500 mt-1">{totalReviews} verified reviews</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-500">No reviews yet.</p>
      ) : (
        <div className="space-y-5">
          {displayedReviews.map((review) => (
            <div
              key={review.id}
              className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-indigo-100 shrink-0">
                    {review.authorAvatar ? (
                      <Image
                        src={review.authorAvatar}
                        alt={review.authorName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-600">
                        <span className="text-white font-bold text-sm">
                          {review.authorName.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900">{review.authorName}</p>
                      {review.verified && (
                        <CheckBadgeIcon className="w-4 h-4 text-blue-500" title="Verified reviewer" />
                      )}
                    </div>
                    {review.authorOrg && (
                      <p className="text-xs text-gray-500">{review.authorOrg}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StarRating rating={review.rating} />
                  <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                </div>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">{review.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{review.body}</p>
            </div>
          ))}
        </div>
      )}

      {reviews.length > 2 && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-5 w-full py-2.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          {showAll ? "Show fewer reviews" : `Show all ${reviews.length} reviews`}
        </button>
      )}
    </section>
  );
}
