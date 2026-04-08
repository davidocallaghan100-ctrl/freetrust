"use client";

import Image from "next/image";
import { Organisation } from "@/types/organisation";

interface CoverAndLogoProps {
  organisation: Organisation;
}

export default function CoverAndLogo({ organisation }: CoverAndLogoProps): JSX.Element {
  return (
    <div className="relative">
      {/* Cover Photo */}
      <div className="h-56 sm:h-72 lg:h-80 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
        {organisation.coverPhoto && (
          <Image
            src={organisation.coverPhoto}
            alt={`${organisation.name} cover photo`}
            fill
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Logo */}
      <div className="absolute bottom-0 left-4 sm:left-8 transform translate-y-1/2">
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-white">
          {organisation.logo ? (
            <Image
              src={organisation.logo}
              alt={`${organisation.name} logo`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-3xl font-bold">
                {organisation.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
