"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";

type NavItem = {
  label: string;
  href: string;
  highlight?: boolean;
  children?: { label: string; href: string; description: string }[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Product",
    href: "#",
    children: [
      { label: "Trust Scores", href: "/trust", description: "See how trust is measured" },
      { label: "Marketplace", href: "/marketplace", description: "Browse verified listings" },
      { label: "Escrow", href: "/escrow", description: "Secure payment protection" },
      { label: "Disputes", href: "/disputes", description: "Fair resolution system" },
    ],
  },
  {
    label: "Community",
    href: "#",
    children: [
      { label: "Members", href: "/members", description: "Meet trusted traders" },
      { label: "Leaderboard", href: "/leaderboard", description: "Top contributors" },
      { label: "Forum", href: "/forum", description: "Discuss & collaborate" },
    ],
  },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  {
    label: "Invest",
    href: "/invest",
    highlight: true,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  const isActive = (href: string) =>
    href !== "#" && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0f172a]/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group shrink-0"
            aria-label="FreeTrust home"
          >
            <div className="relative flex items-center justify-center w-8 h-8">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
              <ShieldCheckIcon className="relative w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Free<span className="text-sky-400">Trust</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              if (item.children) {
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setActiveDropdown(item.label)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    <button
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "text-white bg-white/10"
                          : "text-slate-300 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      {item.label}
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          activeDropdown === item.label ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Dropdown */}
                    <div
                      className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${
                        activeDropdown === item.label
                          ? "opacity-100 translate-y-0 pointer-events-auto"
                          : "opacity-0 -translate-y-1 pointer-events-none"
                      }`}
                    >
                      <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-black/40 p-2 min-w-[220px]">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg transition-colors group/item ${
                              isActive(child.href)
                                ? "bg-sky-500/15 text-sky-400"
                                : "hover:bg-white/8 text-slate-300 hover:text-white"
                            }`}
                          >
                            <span className="text-sm font-medium">{child.label}</span>
                            <span className="text-xs text-slate-500 group-hover/item:text-slate-400 transition-colors">
                              {child.description}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.highlight) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ml-1 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30"
                        : "bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-300 border border-sky-500/30 hover:from-sky-500/30 hover:to-indigo-500/30 hover:text-sky-200 hover:border-sky-400/50 hover:shadow-md hover:shadow-sky-500/20"
                    }`}
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "text-white bg-white/10"
                      : "text-slate-300 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop auth CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/8"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors shadow-md"
            >
              Get started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <XMarkIcon className="w-5 h-5" />
            ) : (
              <Bars3Icon className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[#0f172a]/98 backdrop-blur-xl border-t border-white/10 px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              return (
                <div key={item.label}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2">
                    {item.label}
                  </div>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive(child.href)
                          ? "text-sky-400 bg-sky-500/10"
                          : "text-slate-300 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              );
            }

            if (item.highlight) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-300 border border-sky-500/30 mt-3"
                >
                  <SparklesIcon className="w-4 h-4" />
                  {item.label}
                  <span className="ml-auto text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30">
                    Seed Round
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "text-white bg-white/10"
                    : "text-slate-300 hover:text-white hover:bg-white/8"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Mobile auth */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2 mt-2">
            <Link
              href="/auth/login"
              className="block px-4 py-2.5 rounded-lg text-sm font-medium text-center text-slate-300 hover:text-white hover:bg-white/8 transition-colors border border-white/10"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-center bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

