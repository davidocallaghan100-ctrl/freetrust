"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setQuery("");
    searchRef.current?.blur();
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/organisations", label: "Organisations" },
    { href: "/events", label: "Events" },
    { href: "/about", label: "About" },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 w-full bg-gray-950 border-b border-gray-800 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="flex-shrink-0 flex items-center gap-2 group"
            aria-label="FreeTrust home"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm select-none group-hover:bg-indigo-500 transition-colors">
              FT
            </span>
            <span className="hidden sm:block text-white font-semibold text-base tracking-tight">
              FreeTrust
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className={`flex-1 max-w-xs sm:max-w-sm md:max-w-md transition-all duration-200 ${
              searchFocused ? "max-w-lg" : ""
            }`}
            role="search"
          >
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search organisations, events…"
                aria-label="Search"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </form>

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Notifications — authenticated only */}
            {status === "authenticated" && (
              <button
                type="button"
                aria-label="Notifications"
                className="relative hidden sm:flex items-center justify-center h-9 w-9 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <BellIcon className="h-5 w-5" />
                {/* Notification dot — conditionally rendered */}
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-gray-950" />
              </button>
            )}

            {/* Auth area */}
            {status === "loading" ? (
              <div className="h-8 w-8 rounded-full bg-gray-800 animate-pulse" />
            ) : status === "authenticated" ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  aria-haspopup="true"
                  aria-expanded={profileOpen}
                  aria-label="User menu"
                >
                  {session.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "User avatar"}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-700"
                    />
                  ) : (
                    <UserCircleIcon className="h-7 w-7 text-gray-400" />
                  )}
                  <span className="hidden sm:block max-w-[120px] truncate font-medium">
                    {session.user?.name ?? session.user?.email ?? "Account"}
                  </span>
                  <ChevronDownIcon
                    className={`hidden sm:block h-4 w-4 transition-transform duration-200 ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-lg bg-gray-900 border border-gray-700 shadow-xl py-1 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-800">
                      <p className="text-xs text-gray-500 truncate">Signed in as</p>
                      <p className="text-sm text-gray-200 font-medium truncate">
                        {session.user?.email ?? session.user?.name}
                      </p>
                    </div>
                    {[
                      { href: "/profile", label: "Your Profile" },
                      { href: "/dashboard", label: "Dashboard" },
                      { href: "/settings", label: "Settings" },
                    ].map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setProfileOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                      >
                        {label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-800 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-gray-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors px-3 py-1.5 rounded-md"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <XMarkIcon className="h-5 w-5" />
              ) : (
                <Bars3Icon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {label}
              </Link>
            ))}

            {status === "authenticated" && (
              <>
                <div className="h-px bg-gray-800 my-2" />
                <Link
                  href="/profile"
                  className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Your Profile
                </Link>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}

            {status === "unauthenticated" && (
              <>
                <div className="h-px bg-gray-800 my-2" />
                <Link
                  href="/auth/signin"
                  className="block px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="block px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

