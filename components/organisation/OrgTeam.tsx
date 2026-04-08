import Image from "next/image";
import { TeamMember } from "@/types/organisation";
import { UsersIcon } from "@heroicons/react/24/outline";

interface OrgTeamProps {
  teamMembers: TeamMember[];
}

export default function OrgTeam({ teamMembers }: OrgTeamProps): JSX.Element {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
        <UsersIcon className="w-5 h-5 text-indigo-500" />
        Team Members
      </h2>

      {teamMembers.length === 0 ? (
        <p className="text-sm text-gray-500">No team members listed.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
            >
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 bg-indigo-100 shrink-0">
                {member.avatar ? (
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-600">
                    <span className="text-white text-lg font-bold">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate">{member.name}</p>
                <p className="text-xs text-gray-500 truncate">{member.role}</p>
              </div>
              {member.linkedinUrl && (
                <a
                  href={member.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${member.name} LinkedIn profile`}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
