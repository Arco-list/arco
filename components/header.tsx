"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type Dispatch, type SetStateAction, type RefObject } from "react";
import Image from "next/image";
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { signOutAction } from "@/app/(auth)/actions";
import { useAuth } from "@/contexts/auth-context";
import { useLoginModal } from "@/contexts/login-modal-context";
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context";
// CompanySwitcher functionality is now integrated into the dropdown menu
import { getUserCompaniesAction, switchCompanyAction } from "@/app/dashboard/company/actions";
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher";

export interface NavLink {
  href: string;
  label: string;
}

export interface HeaderProps {
  transparent?: boolean;
  maxWidth?: string;
  navLinks?: NavLink[];
}

type SearchResult = {
  projects: Array<{ id: string; title: string; slug: string; location: string | null; photo: string | null; category: string | null }>;
  professionals: Array<{ id: string; name: string; slug: string; logo: string | null; city: string | null; service: string | null }>;
};

function SearchOverlay({ searchQuery, setSearchQuery, inputRef, onSearch, onClose, t }: {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  onSearch: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [results, setResults] = useState<SearchResult>({ projects: [], professionals: [] });
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const trimmedQuery = searchQuery.trim();
  const hasResults = results.projects.length > 0 || results.professionals.length > 0;
  const encoded = encodeURIComponent(trimmedQuery);

  const fetchResults = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults({ projects: [], professionals: [] }); return; }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } catch {}
      setIsLoading(false);
    }, 250);
  }, []);

  useEffect(() => { fetchResults(trimmedQuery); }, [trimmedQuery, fetchResults]);

  return (
    <div className="popup-overlay" style={{ alignItems: "flex-start", paddingTop: 80 }} onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="popup-header">
          <h3 className="arco-section-title">Search</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Search input */}
        <form onSubmit={(e) => { onSearch(e); onClose(); }}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1a0]" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={String(t("search_arco"))}
              className="w-full h-11 pl-9 pr-4 border border-[#e5e5e4] rounded-[3px] text-sm outline-none focus:border-[#1c1c1a] transition-colors"
              autoFocus
            />
          </div>
        </form>

        {/* Results */}
        {trimmedQuery.length >= 2 && (
          <div style={{ maxHeight: "50vh", overflowY: "auto", marginTop: 16 }}>
            {isLoading && !hasResults && (
              <p className="text-xs text-[#a1a1a0] py-2">Searching…</p>
            )}

            {results.projects.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 8 }}>Projects</p>
                {results.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-[#fafaf9] -mx-3 px-3 transition-colors" onClick={onClose}>
                    {p.photo ? (
                      <Image src={sanitizeImageUrl(p.photo, IMAGE_SIZES.thumbnail)} alt={p.title} width={40} height={40} className="rounded-[3px] object-cover shrink-0" style={{ width: 40, height: 40 }} />
                    ) : (
                      <div className="w-10 h-10 rounded-[3px] bg-[#f5f5f4] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1c1c1a] truncate">{p.title}</p>
                      {(p.location || p.category) && <p className="text-xs text-[#a1a1a0] truncate">{[p.category, p.location].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </Link>
                ))}
                <Link href={`/projects?search=${encoded}`} className="block py-2 text-xs font-medium text-[#016D75] hover:underline" onClick={onClose}>
                  {String(t("search_all_projects"))}
                </Link>
              </div>
            )}

            {results.professionals.length > 0 && (
              <div className={results.projects.length > 0 ? "border-t border-[#e5e5e4] pt-3" : ""}>
                <p className="arco-eyebrow" style={{ color: "#a1a1a0", marginBottom: 8 }}>Professionals</p>
                {results.professionals.map((p) => (
                  <Link key={p.id} href={`/professionals/${p.slug}`} className="flex items-center gap-3 py-2.5 hover:bg-[#fafaf9] -mx-3 px-3 transition-colors" onClick={onClose}>
                    {p.logo ? (
                      <Image src={sanitizeImageUrl(p.logo, IMAGE_SIZES.thumbnail)} alt={p.name} width={40} height={40} className="rounded-full object-cover shrink-0" style={{ width: 40, height: 40 }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#f5f5f4] shrink-0 flex items-center justify-center text-xs font-medium text-[#6b6b68]">{p.name.charAt(0).toUpperCase()}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1c1c1a] truncate">{p.name}</p>
                      {(p.service || p.city) && <p className="text-xs text-[#a1a1a0] truncate">{[p.service, p.city].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </Link>
                ))}
                <Link href={`/professionals?search=${encoded}`} className="block py-2 text-xs font-medium text-[#016D75] hover:underline" onClick={onClose}>
                  {String(t("search_all_professionals"))}
                </Link>
              </div>
            )}

            {!isLoading && !hasResults && (
              <div className="py-2">
                <p className="text-xs text-[#a1a1a0] mb-3">No results found</p>
                <div className="flex flex-col gap-1">
                  <Link href={`/projects?search=${encoded}`} className="text-xs font-medium text-[#016D75] hover:underline" onClick={onClose}>{String(t("search_all_projects"))}</Link>
                  <Link href={`/professionals?search=${encoded}`} className="text-xs font-medium text-[#016D75] hover:underline" onClick={onClose}>{String(t("search_all_professionals"))}</Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Header({ transparent = false, maxWidth = "max-w-[1800px]", navLinks }: HeaderProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamQuery = searchParams.get("search") ?? "";
  const { profile, user } = useAuth();
  const { openLoginModal } = useLoginModal();
  const { openCreateCompanyModal } = useCreateCompanyModal();

  const defaultNavLinks: NavLink[] = [
    { href: "/projects", label: t("projects") },
    { href: "/professionals", label: t("professionals") },
  ];
  const resolvedNavLinks = navLinks ?? defaultNavLinks;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParamQuery);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = Boolean(user);
  const sessionMetadata = user?.user_metadata ?? {};
  const metadataFirstName =
    typeof sessionMetadata.first_name === "string"
      ? sessionMetadata.first_name
      : typeof sessionMetadata.firstName === "string"
        ? sessionMetadata.firstName
        : undefined;
  const derivedFirstName = (profile?.first_name || metadataFirstName)?.toString().trim();
  const fallbackName = user?.email ? user.email.split("@")[0] : undefined;
  const rawMenuLabel = derivedFirstName || fallbackName;
  const menuLabel = rawMenuLabel && rawMenuLabel.trim().length > 0 ? rawMenuLabel.trim() : "Menu";
  const avatarUrl = profile?.avatar_url ?? null;
  const userInitial = (derivedFirstName ?? user?.email ?? "U").charAt(0).toUpperCase();

  // Company data for menu
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; logo_url: string | null; role: "owner" | "member" }>>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserCompaniesAction().then(({ companies: c, activeId }) => {
      console.log("[Header] Companies loaded:", c.length, c.map(co => co.name));
      setCompanies(c);
      setActiveCompanyId(activeId);
    }).catch(() => {});
  }, [user]);

  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? companies[0] ?? null;

  // Check if user has professional role
  const metadataUserTypes = Array.isArray(sessionMetadata.user_types)
    ? (sessionMetadata.user_types as string[])
    : typeof sessionMetadata.user_types === "string"
      ? [sessionMetadata.user_types]
      : null;
  const userTypes = profile?.user_types ?? metadataUserTypes;
  const hasProfessionalRole = userTypes?.includes("professional") ?? false;
  const hasAdminRole = userTypes?.includes("admin") ?? false;

  const toggleMenu = () => setIsMenuOpen((open) => !open);
  
  const toggleSearch = () => {
    setIsSearchOpen((open) => {
      if (!open) {
        // Opening search
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      return !open;
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutAction();

      if (result?.error) {
        toast.error("Unable to sign out", { description: result.error.message });
        return;
      }

      toast.success("Signed out");
      setIsMenuOpen(false);
      window.location.href = "/";
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchQuery(searchParamQuery);
  }, [searchParamQuery]);

  // Scroll detection - triggers at 0px
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close search on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSearchOpen]);

  // Header sits above the filter bar (z-[300] > filter bar z-[150])
  // so navigation dropdowns always render on top of the filter bar.
  //
  // CLS note: when `transparent` (homepage), the header swaps background
  // from transparent → white at scrollY > 0. The padding and border MUST
  // stay identical between states or the header height changes by 1-8px
  // and pushes the entire page content. We always use `py-3 md:py-4` and
  // a transparent border that becomes visible — same box model in both
  // states, only the colours animate.
  const headerClasses = transparent
    ? `fixed top-0 left-0 right-0 z-[300] py-3 md:py-4 border-b transition-colors duration-200 ${
        isScrolled
          ? "bg-white border-[#e5e5e4]"
          : "bg-transparent border-transparent"
      }`
    : "fixed top-0 left-0 right-0 z-[300] border-b border-[#e5e5e4] bg-white py-3 md:py-4";


  return (
    <>
      <header className={headerClasses}>
        {/* UPDATED: Use .wrap class */}
        <div className="wrap">
          <div className="relative flex items-center justify-between">
            {/* Left: Mobile hamburger + Logo + Nav Links */}
            <div className="flex items-center gap-6 max-md:gap-3">
              {/* Mobile hamburger — only on mobile */}
              <button
                className={`flex flex-col gap-1 p-1 md:hidden transition-opacity hover:opacity-70 ${
                  transparent && !isScrolled ? "text-white" : "text-black"
                }`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Navigation"
              >
                <span className={`block w-[18px] h-[1.5px] ${transparent && !isScrolled ? "bg-white" : "bg-black"}`} />
                <span className={`block w-[18px] h-[1.5px] ${transparent && !isScrolled ? "bg-white" : "bg-black"}`} />
                <span className={`block w-[18px] h-[1.5px] ${transparent && !isScrolled ? "bg-white" : "bg-black"}`} />
              </button>

              {/* Mobile nav dropdown */}
              {isMobileMenuOpen && (
                <div className="absolute left-0 top-full z-50 w-48 border border-border bg-white shadow-lg mt-2 md:hidden" ref={menuRef}>
                  <div className="py-2">
                    {resolvedNavLinks.map((link) => {
                      const linkPath = link.href.split("?")[0]
                      return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-5 py-2 text-sm transition-colors ${pathname === linkPath ? "text-primary font-medium" : "text-[#1c1c1a] hover:text-primary"}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <Link href="/">
                <img
                  src={
                    transparent && !isScrolled
                      ? "/images/arco-logo-white.svg"
                      : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                  }
                  alt="Arco"
                  className="h-auto w-[48px] transition-all"
                  style={{
                    filter: transparent && !isScrolled ? 'brightness(0) invert(1)' : 'brightness(0)'
                  }}
                />
              </Link>
              <div className="hidden items-center gap-6 md:flex">
                {resolvedNavLinks.map((link) => {
                  const linkPath = link.href.split("?")[0]
                  const isActive = pathname === linkPath
                  return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-normal whitespace-nowrap transition-colors ${
                      isActive
                        ? "text-primary"
                        : transparent && !isScrolled ? "text-white/80 hover:text-white" : "text-[#1c1c1a] hover:text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: Language + Search + Menu */}
            <div className="relative flex items-center justify-end gap-3">
              {/* Language Switcher */}
              <HeaderLanguageSwitcher isLight={transparent && !isScrolled} />
              {/* Search Icon */}
              <button
                onClick={toggleSearch}
                className={`flex items-center justify-center h-8 transition-opacity hover:opacity-70 ${
                  transparent && !isScrolled ? "text-white" : "text-black"
                }`}
                style={{ opacity: 0.6 }}
                aria-label="Search"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Account menu button */}
              <div className="relative" ref={accountMenuRef}>
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((o) => !o)}
                    className={`flex items-center gap-2 h-8 rounded-full border pr-3 pl-0.5 transition-colors ${
                      transparent && !isScrolled
                        ? "border-white/30 text-white hover:bg-white/10"
                        : "border-[#e5e5e4] text-[#1c1c1a] hover:bg-[#f5f5f4]"
                    }`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: transparent && !isScrolled ? "rgba(255,255,255,.2)" : "#1c1c1a", color: "#fff" }}>
                        {userInitial}
                      </span>
                    )}
                    <span className="text-sm hidden sm:inline">{menuLabel}</span>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((o) => !o)}
                    className={`flex items-center gap-2 h-8 rounded-full border pr-3 pl-3 transition-colors ${
                      transparent && !isScrolled
                        ? "border-white/30 text-white hover:bg-white/10"
                        : "border-[#e5e5e4] text-[#1c1c1a] hover:bg-[#f5f5f4]"
                    }`}
                  >
                    <span className="text-sm">{t("menu")}</span>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                )}

                {isAccountMenuOpen && (
                  <div
                    className="absolute right-0 z-50 w-56 border border-border bg-white shadow-lg rounded-[3px] [&_svg]:shrink-0"
                    style={{ top: 'calc(100% + 12px)' }}
                  >
                    <div className="py-2">

                      {/* Company section — for professionals */}
                      {hasProfessionalRole && activeCompany && (
                        <>
                          {/* Company header — click to expand switcher */}
                          <div className="px-4 py-3">
                            <button
                              type="button"
                              className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); if (companies.length > 1) setShowCompanySwitcher(!showCompanySwitcher) }}
                            >
                              {activeCompany.logo_url ? (
                                <img src={activeCompany.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-[#f0f0ee] flex items-center justify-center text-[9px] font-medium text-[#6b6b68]">
                                  {activeCompany.name.charAt(0)}
                                </span>
                              )}
                              <span className="text-sm text-[#1c1c1a] truncate flex-1">{activeCompany.name}</span>
                              {companies.length > 1 && (
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#a1a1a0" strokeWidth="2" strokeLinecap="round" className="shrink-0 transition-transform" style={{ transform: showCompanySwitcher ? "rotate(180deg)" : "none" }}>
                                  <path d="M4 6l4 4 4-4" />
                                </svg>
                              )}
                            </button>
                          </div>
                          {/* Other companies — separate div to avoid event bubbling */}
                          {showCompanySwitcher && companies.length > 1 && (
                            <div className="px-4 pb-2">
                              <div className="flex flex-col gap-0.5 pt-2 border-t border-[#f0f0ee]">
                                {companies.filter(c => c.id !== activeCompanyId).map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="flex items-center gap-2 px-1 py-1.5 text-sm text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors text-left w-full"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      const result = await switchCompanyAction(c.id)
                                      if (result.success) {
                                        setActiveCompanyId(c.id)
                                        setShowCompanySwitcher(false)
                                        setIsAccountMenuOpen(false)
                                        // If on a dashboard page, navigate with new company_id
                                        if (pathname?.startsWith("/dashboard/")) {
                                          const basePath = pathname.split("?")[0]
                                          window.location.href = `${basePath}?company_id=${c.id}`
                                        } else {
                                          router.refresh()
                                        }
                                      } else {
                                        toast.error("Failed to switch company")
                                      }
                                    }}
                                  >
                                    {c.logo_url ? (
                                      <img src={c.logo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                                    ) : (
                                      <span className="w-4 h-4 rounded-full bg-[#f0f0ee] flex items-center justify-center text-[8px] font-medium text-[#a1a1a0]">
                                        {c.name.charAt(0)}
                                      </span>
                                    )}
                                    <span className="truncate">{c.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="border-t border-border mx-4" />
                          <div className="px-4 py-2">
                            <Link href={`/dashboard/listings${activeCompanyId ? `?company_id=${activeCompanyId}` : ""}`} className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/dashboard/listings" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                              {t("listings")}
                            </Link>
                            <Link href={`/dashboard/company${activeCompanyId ? `?company_id=${activeCompanyId}` : ""}`} className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/dashboard/company" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                              {t("company")}
                            </Link>
                            <Link href={`/dashboard/team${activeCompanyId ? `?company_id=${activeCompanyId}` : ""}`} className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/dashboard/team" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                              {t("team")}
                            </Link>
                            <Link href="/dashboard/inbox" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/dashboard/inbox" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3H10l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
                              {t("inbox")}
                            </Link>
                            <Link href="/dashboard/pricing" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/dashboard/pricing" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                              {t("plans")}
                            </Link>
                          </div>
                          <div className="border-t border-border mx-4" />
                        </>
                      )}

                      {/* Businesses — for non-professionals */}
                      {!hasProfessionalRole && (
                        <>
                          <div className="px-4 py-2">
                            <Link href="/businesses/architects" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/businesses/architects" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                              {t("for_architects")}
                            </Link>
                            <Link href="/businesses/professionals" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/businesses/professionals" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                              {t("for_professionals")}
                            </Link>
                          </div>
                          <div className="border-t border-border mx-4" />
                        </>
                      )}

                      {/* Messages + Saved — only when logged in */}
                      {isLoggedIn && (
                        <>
                          <div className="px-4 py-2">
                            <Link href="/homeowner?tab=messages" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/homeowner" && searchParams.get("tab") === "messages" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                              {t("messages")}
                            </Link>
                            <Link href="/homeowner?tab=saved-projects" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/homeowner" && (!searchParams.get("tab") || searchParams.get("tab") === "saved-projects") ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                              {t("saved_projects")}
                            </Link>
                            <Link href="/homeowner?tab=saved-professionals" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/homeowner" && searchParams.get("tab") === "saved-professionals" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                              {t("saved_professionals")}
                            </Link>
                          </div>
                          <div className="border-t border-border mx-4" />
                        </>
                      )}

                      {/* Bottom links */}
                      <div className="px-4 py-2">
                        {isLoggedIn ? (
                          <>
                            {hasAdminRole && (
                              <>
                                <Link href="/admin/users" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/users" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                                  {t("admin_users")}
                                </Link>
                                <Link href="/admin/projects" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/projects" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                                  {t("admin_projects")}
                                </Link>
                                <Link href="/admin/professionals" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/professionals" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                  {t("admin_companies")}
                                </Link>
                                <Link href="/admin/categories" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/categories" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                                  {t("admin_categories")}
                                </Link>
                                <Link href="/admin/emails" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/emails" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                  {t("admin_emails")}
                                </Link>
                                <Link href="/admin/growth" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/growth" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                                  {t("admin_growth")}
                                </Link>
                                <Link href="/admin/prospects" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/admin/prospects" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                                  {t("admin_sales")}
                                </Link>
                              </>
                            )}
                            {hasAdminRole && <div className="border-t border-border my-2 -mx-1" />}
                            <Link href="/homeowner?tab=account" className={`flex items-center gap-2.5 px-1 py-1.5 text-sm transition-colors truncate ${pathname === "/homeowner" && searchParams.get("tab") === "account" ? "text-primary" : "text-[#1c1c1a] hover:text-primary"}`} onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                              {t("account")}
                            </Link>
                            <Link href="/help-center" className="flex items-center gap-2.5 px-1 py-1.5 text-sm text-[#1c1c1a] hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              {t("help")}
                            </Link>
                            <button
                              type="button"
                              className="flex items-center gap-2.5 px-1 py-1.5 text-sm text-[#1c1c1a] hover:text-primary transition-colors w-full text-left"
                              onClick={handleSignOut}
                              disabled={isSigningOut}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                              {isSigningOut ? t("signing_out") : t("sign_out")}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link href="/help-center" className="flex items-center gap-2.5 px-1 py-1.5 text-sm text-[#1c1c1a] hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              Help & FAQ
                            </Link>
                            <button
                              type="button"
                              className="flex items-center gap-2.5 px-1 py-1.5 text-sm text-[#1c1c1a] hover:text-primary transition-colors w-full text-left"
                              onClick={() => { setIsAccountMenuOpen(false); openLoginModal(pathname ?? undefined) }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                              Sign up / Log in
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search Overlay - full screen modal */}
      {isSearchOpen && (
        <SearchOverlay
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          inputRef={searchInputRef}
          onSearch={handleSearch}
          onClose={() => setIsSearchOpen(false)}
          t={t}
        />
      )}
    </>
  );
}
