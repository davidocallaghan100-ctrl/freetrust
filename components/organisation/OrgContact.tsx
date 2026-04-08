import { ContactDetails } from "@/types/organisation";
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

interface OrgContactProps {
  contact: ContactDetails;
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="text-sm text-indigo-600 hover:underline break-all"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm text-gray-900 break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

function SocialIcon({ name }: { name: string }): JSX.Element {
  const icons: Record<string, JSX.Element> = {
    twitter: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    linkedin: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    facebook: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    instagram: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  };
  return icons[name] ?? <GlobeAltIcon className="w-4 h-4" />;
}

export default function OrgContact({ contact }: OrgContactProps): JSX.Element {
  const address = [contact.address, contact.city, contact.postcode, contact.country]
    .filter(Boolean)
    .join(", ");

  const socialEntries = contact.socialLinks
    ? Object.entries(contact.socialLinks).filter(([, url]) => Boolean(url))
    : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Contact & Location</h3>

      <div className="space-y-4">
        <ContactRow
          icon={<EnvelopeIcon className="w-4 h-4 text-indigo-500" />}
          label="Email"
          value={contact.email}
          href={`mailto:${contact.email}`}
        />

        {contact.phone && (
          <ContactRow
            icon={<PhoneIcon className="w-4 h-4 text-indigo-500" />}
            label="Phone"
            value={contact.phone}
            href={`tel:${contact.phone}`}
          />
        )}

        {address && (
          <ContactRow
            icon={<MapPinIcon className="w-4 h-4 text-indigo-500" />}
            label="Address"
            value={address}
          />
        )}

        {contact.socialLinks?.website && (
          <ContactRow
            icon={<GlobeAltIcon className="w-4 h-4 text-indigo-500" />}
            label="Website"
            value={contact.socialLinks.website.replace(/^https?:\/\//, "")}
            href={contact.socialLinks.website}
          />
        )}
      </div>

      {socialEntries.filter(([name]) => name !== "website").length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Social Media
          </p>
          <div className="flex flex-wrap gap-2">
            {socialEntries
              .filter(([name]) => name !== "website")
              .map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors text-xs font-medium capitalize"
                >
                  <SocialIcon name={name} />
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
