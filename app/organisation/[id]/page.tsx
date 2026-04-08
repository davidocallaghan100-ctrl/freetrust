import { Metadata } from "next";
import { notFound } from "next/navigation";
import OrganisationProfile from "@/components/organisation/OrganisationProfile";
import { getOrganisationById } from "@/lib/organisation/getOrganisation";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const org = await getOrganisationById(params.id);
  if (!org) return { title: "Organisation Not Found | FreeTrust" };
  return {
    title: `${org.name} | FreeTrust`,
    description: org.description,
    openGraph: {
      title: org.name,
      description: org.description,
      images: org.coverPhoto ? [org.coverPhoto] : [],
    },
  };
}

export default async function OrganisationPage({ params }: PageProps) {
  const org = await getOrganisationById(params.id);
  if (!org) notFound();
  return <OrganisationProfile organisation={org} />;
}
