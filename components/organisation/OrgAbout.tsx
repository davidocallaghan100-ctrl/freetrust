import { Organisation } from "@/types/organisation";
import { InformationCircleIcon, LightBulbIcon } from "@heroicons/react/24/outline";

interface OrgAboutProps {
  organisation: Organisation;
}

export default function OrgAbout({ organisation }: OrgAboutProps): JSX.Element {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <InformationCircleIcon className="w-5 h-5 text-indigo-500" />
        About
      </h2>
      <p className="text-gray-600 leading-relaxed mb-6 text-sm">{organisation.description}</p>

      <div className="border-t border-gray-100 pt-5">
        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
          <LightBulbIcon className="w-4 h-4 text-amber-500" />
          Our Mission
        </h3>
        <blockquote className="border-l-4 border-indigo-500 pl-4 text-gray-600 text-sm leading-relaxed italic">
          {organisation.mission}
        </blockquote>
      </div>
    </section>
  );
}
