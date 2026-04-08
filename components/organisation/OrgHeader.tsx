"use client";

import { useState } from "react";
import { Organisation } from "@/types/organisation";
import { useOrganisationStore } from "@/store/organisationStore";
import VerifiedBadge from "@/components/organisation/VerifiedBadge";
import OrgTypePill from "@/components/organisation/OrgTypePill";
import {
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  UserPlusIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";

interface OrgHeaderProps {
  organisation: Organisation;
}

export default function OrgHeader({ organisation }: OrgHeaderProps): JSX.Element {
  const { follow, unfollow, isFollowing } = useOrganisationStore();
  const following = isFollowing(organisation.id);
  const [localFollowersCount, setLocalFollowersCount] = useState<number>(
    organisation.followersCount
  );

  const handleFollowToggle = (): void => {
    if (following) {
      unfollow(organisation.id);
      setLocalFollowersCount((prev) => prev - 1);
    } else {
      follow(organisation.id);
      setLocalFollowersCount((prev) => prev + 1);
    }
  };

  const location =
    [organisation.contact.city, organisation.contact.country]
      .filter(Boolean)
      .join(", ") || null;

  return (
    <div className="mt-16 sm:mt-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            {organisation.name}
          </h1>
          {organisation.isVerified && <VerifiedBadge />}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <OrgTypePill type={organisation.type} />
          {location && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <MapPinIcon className="w-4 h-4" />
              {location}
            </span>
          )}
          {organisation.foundedYear && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <CalendarIcon className="w-4 h-4" />
              Est. {organisation.foundedYear}
            </span>
          )}
          {organisation.employeeCount && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <UsersIcon className="w-4 h-4" />
              {organisation.employeeCount} employees
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {organisation.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
        <button
          onClick={handleFollowToggle}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm ${
            following
              ? "bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50"
              : "bg-indigo-600 text-white border-2 border-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {following ? (
            <>
              <UserMinusIcon className="w-4 h-4" />
              Following
            </>
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4" />
              Follow
            </>
          )}
        </button>
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">
            {localFollowersCount.toLocaleString()}
          </span>{" "}
          followers
        </span>
      </div>
    </div>
  );
}
