"use client";

import { Organisation } from "@/types/organisation";
import CoverAndLogo from "@/components/organisation/CoverAndLogo";
import OrgHeader from "@/components/organisation/OrgHeader";
import OrgAbout from "@/components/organisation/OrgAbout";
import OrgServices from "@/components/organisation/OrgServices";
import OrgTeam from "@/components/organisation/OrgTeam";
import OrgReviews from "@/components/organisation/OrgReviews";
import OrgContact from "@/components/organisation/OrgContact";
import TrustScoreBadge from "@/components/organisation/TrustScoreBadge";

interface OrganisationProfileProps {
  organisation: Organisation;
}

export default function OrganisationProfile({ organisation }: OrganisationProfileProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      <CoverAndLogo organisation={organisation} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <OrgHeader organisation={organisation} />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <OrgAbout organisation={organisation} />
            <OrgServices services={organisation.services} />
            <OrgTeam teamMembers={organisation.teamMembers} />
            <OrgReviews
              reviews={organisation.reviews}
              trustScore={organisation.trustScore}
              totalReviews={organisation.totalReviews}
            />
          </div>
          <div className="space-y-6">
            <TrustScoreBadge
              score={organisation.trustScore}
              totalReviews={organisation.totalReviews}
              isVerified={organisation.isVerified}
            />
            <OrgContact contact={organisation.contact} />
          </div>
        </div>
      </div>
    </div>
  );
}
