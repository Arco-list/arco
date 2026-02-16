"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/actions";
import { HeaderSearch } from "@/components/header-search";
import { useAuth } from "@/contexts/auth-context";

export interface HeaderProps {
  transparent?: boolean;
  maxWidth?: string;
}

export function Header({ transparent = false, maxWidth = "max-w-[1800px]" }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamQuery = searchParams.get("search") ?? "";
  const { profile, user } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParamQuery);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup";
  const shouldShowLoginLink = !isLoggedIn && !isLoginPage;
  const shouldShowSignupLink = !isLoggedIn && !isSignupPage;

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

  // Solid white background when scrolled, proper z-index
  const headerClasses = transparent
    ? `fixed top-0 left-0 right-0 z-[200] transition-all duration-200 ${
        isScrolled 
          ? "bg-white border-b border-[#e5e5e4] py-3 md:py-4" 
          : "py-4"
      }`
    : "fixed top-0 left-0 right-0 z-[200] border-b border-[#e5e5e4] bg-white py-3 md:py-4";

  const textColor = transparent && !isScrolled ? "text-white" : "text-black";

  const redirectQuery = pathname ? `?redirectTo=${encodeURIComponent(pathname)}` : "";

  return (
    <>
      <header className={headerClasses}>
        {/* UPDATED: Use .wrap class */}
        <div className="wrap">
          <div className="relative grid grid-cols-3 items-center gap-5">
            {/* Left: Hamburger + Nav Links */}
            <div className="relative flex items-center gap-6">
              <button
                className={`flex flex-col gap-1 p-1 transition-opacity hover:opacity-70 ${
                  transparent && !isScrolled ? "text-white" : "text-black"
                }`}
                onClick={toggleMenu}
                aria-label="Menu"
              >
                <span className={`block w-[18px] h-[1.5px] transition-colors ${
                  transparent && !isScrolled ? "bg-white" : "bg-black"
                }`}></span>
                <span className={`block w-[18px] h-[1.5px] transition-colors ${
                  transparent && !isScrolled ? "bg-white" : "bg-black"
                }`}></span>
                <span className={`block w-[18px] h-[1.5px] transition-colors ${
                  transparent && !isScrolled ? "bg-white" : "bg-black"
                }`}></span>
              </button>

              {/* Hamburger Menu - positioned relative to button */}
              {isMenuOpen && (
                <div 
                  className="absolute z-50 w-56 border border-border bg-white shadow-lg" 
                  ref={menuRef}
                  style={{ 
                    left: '0',
                    top: 'calc(100% + 16px)'
                  }}
                >
                  <div className="py-1">
                    {/* Section 1: Projects / Professionals */}
                    <div className="px-4 py-3">
                      <Link
                        href="/projects"
                        className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Projects
                      </Link>
                      <Link
                        href="/professionals"
                        className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Professionals
                      </Link>
                    </div>
                    
                    {/* Divider */}
                    <div className="border-t border-border" />
                    
                    {/* Section 2: Login/Signup OR Saved projects/Saved professionals/Account */}
                    <div className="px-4 py-3">
                      {isLoggedIn ? (
                        <>
                          <Link
                            href="/homeowner?tab=saved-projects"
                            className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Saved projects
                          </Link>
                          <Link
                            href="/homeowner?tab=saved-professionals"
                            className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Saved professionals
                          </Link>
                          <Link
                            href="/homeowner?tab=account"
                            className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Account
                          </Link>
                          {hasAdminRole && (
                            <Link
                              href="/admin"
                              className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                              onClick={() => setIsMenuOpen(false)}
                            >
                              Admin
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          {shouldShowLoginLink && (
                            <Link
                              href={`/login${redirectQuery}`}
                              className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                              onClick={() => setIsMenuOpen(false)}
                            >
                              Login
                            </Link>
                          )}
                          {shouldShowSignupLink && (
                            <Link
                              href={`/signup${redirectQuery}`}
                              className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                              onClick={() => setIsMenuOpen(false)}
                            >
                              Sign up
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Divider */}
                    <div className="border-t border-border" />
                    
                    {/* Section 3: List with us/Help center/Sign out */}
                    <div className="px-4 py-3">
                      {hasProfessionalRole ? (
                        <Link
                          href="/dashboard/listings"
                          className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Switch to company
                        </Link>
                      ) : (
                        <Link
                          href="/list-with-us"
                          className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          List with us
                        </Link>
                      )}
                      <Link
                        href="/help-center"
                        className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Help center
                      </Link>
                      {isLoggedIn && (
                        <button
                          type="button"
                          className="block w-full text-left arco-nav-text text-red-600 px-3 py-1.5 hover:bg-red-50 transition-colors"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? "Signing out..." : "Sign out"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Nav links white when transparent */}
              <div className="hidden items-center gap-6 md:flex">
                <Link
                  href="/projects"
                  className={`arco-nav-text whitespace-nowrap ${
                    transparent && !isScrolled ? "nav-transparent" : "hover:text-primary"
                  }`}
                >
                  Projects
                </Link>
                <Link
                  href="/professionals"
                  className={`arco-nav-text whitespace-nowrap ${
                    transparent && !isScrolled ? "nav-transparent" : "hover:text-primary"
                  }`}
                >
                  Professionals
                </Link>
              </div>
            </div>

            {/* Center: Logo */}
            <div className="flex justify-center">
              <Link href="/">
                <img
                  src={
                    transparent && !isScrolled
                      ? "/images/arco-logo-white.svg"
                      : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                  }
                  alt="Arco"
                  className="h-auto w-[60px] transition-all"
                  style={{
                    filter: transparent && !isScrolled ? 'brightness(0) invert(1)' : 'brightness(0)'
                  }}
                />
              </Link>
            </div>

            {/* Right: Search + Login */}
            <div className="relative flex items-center justify-end gap-3">
              {/* Search Icon */}
              <button
                onClick={toggleSearch}
                className={`flex items-center justify-center w-8 h-8 transition-opacity hover:opacity-70 ${
                  transparent && !isScrolled ? "text-white" : "text-black"
                }`}
                aria-label="Search"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Login button - CSS classes handle colors */}
              <Link
                href={isLoggedIn ? (hasProfessionalRole ? "/dashboard/company" : "/homeowner") : `/login${redirectQuery}`}
                className={`arco-nav-text px-[18px] py-[7px] rounded-[3px] whitespace-nowrap ${
                  transparent && !isScrolled ? "btn-transparent" : "btn-scrolled"
                }`}
              >
                {isLoggedIn ? menuLabel : "Log in"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Search Overlay - full screen modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[250] flex items-start justify-center pt-20"
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-[600px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="p-6">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-[3px] text-[15px] outline-none focus:border-black transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  aria-label="Submit search"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <p className="arco-small-text mt-3 text-center">
                Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">ESC</kbd> to close
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
