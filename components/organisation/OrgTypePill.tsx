import { OrganisationType } from "@/types/organisation";
import { BuildingOfficeIcon, HeartIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface OrgTypePillProps {
  type: OrganisationType;
}

const typeConfig: Record<OrganisationType, { label: string; bg: string; text: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  Business: {
    label: "Business",
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    Icon: BuildingOfficeIcon,
  },
  Charity: {
    label: "Charity",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    Icon: HeartIcon,
  },
  "Social Enterprise": {
    label: "Social Enterprise",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    Icon: SparklesIcon,
  },
};

export default function OrgTypePill({ type }: OrgTypePillProps): JSX.Element {
  const config = typeConfig[type];
  const { Icon } = config;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
