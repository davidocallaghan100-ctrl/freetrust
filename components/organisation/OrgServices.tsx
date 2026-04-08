"use client";

import { useState } from "react";
import { Service } from "@/types/organisation";
import { BriefcaseIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface OrgServicesProps {
  services: Service[];
}

const categoryColors: Record<string, string> = {
  Consulting: "bg-purple-50 text-purple-700 border-purple-200",
  Strategy: "bg-blue-50 text-blue-700 border-blue-200",
  Funding: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Training: "bg-amber-50 text-amber-700 border-amber-200",
  Default: "bg-gray-50 text-gray-700 border-gray-200",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] ?? categoryColors["Default"];
}

export default function OrgServices({ services }: OrgServicesProps): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (id: string): void => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
        <BriefcaseIcon className="w-5 h-5 text-indigo-500" />
        Services & Products
      </h2>

      {services.length === 0 ? (
        <p className="text-sm text-gray-500">No services listed yet.</p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const isOpen = expanded === service.id;
            return (
              <div
                key={service.id}
                className="border border-gray-100 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(service.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${getCategoryColor(service.category)}`}
                    >
                      {service.category}
                    </span>
                    <span className="font-semibold text-gray-900 text-sm truncate">
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {service.price && (
                      <span className="text-sm font-medium text-indigo-600">
                        {service.price}
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed pt-3">
                      {service.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
