"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type React from "react";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
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
  const [searchQuery, setSearchQuery] = useState(searchParamQuery);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
  const shouldRenderAuthTrigger = !isLoggedIn;
  const authTriggerLabel = isLoginPage ? "Menu" : "Login";
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

  const toggleMenu = () => setIsMenuOpen((open) => !open);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMenuOpen(false);
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
      router.refresh();
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerClasses = transparent
    ? `fixed top-0 left-0 right-0 z-50 px-4 md:px-8 transition-all duration-200 ${
        isScrolled 
          ? "bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm py-3 md:py-4" 
          : "py-4"
      }`
    : "fixed top-0 left-0 right-0 z-50 border-b border-gray-200 px-4 md:px-8 bg-white/95 backdrop-blur-md py-3 md:py-4";

  const textColor = transparent && !isScrolled ? "text-white" : "text-black";
  const hoverColor = transparent && !isScrolled ? "hover:text-gray-300" : "hover:text-gray-600";

  const redirectQuery = pathname ? `?redirectTo=${encodeURIComponent(pathname)}` : "";

  return (
    <header className={headerClasses}>
      <div className={`mx-auto ${maxWidth}`}>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <img
                src={
                  transparent && !isScrolled
                    ? "/images/arco-logo-white.svg"
                    : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                }
                alt="Arco Logo"
                className="h-4 w-auto"
              />
            </Link>

            <div className="hidden items-center space-x-6 md:flex">
              <Link
                href="/projects"
                className={`text-sm font-medium transition-colors border-b-2 pb-1 ${
                  pathname.startsWith("/projects")
                    ? "text-red-500 border-red-500"
                    : `${textColor} ${hoverColor} border-transparent`
                }`}
              >
                Projects
              </Link>
              <Link
                href="/professionals"
                className={`text-sm font-medium transition-colors border-b-2 pb-1 ${
                  pathname.startsWith("/professionals")
                    ? "text-red-500 border-red-500"
                    : `${textColor} ${hoverColor} border-transparent`
                }`}
              >
                Professionals
              </Link>
            </div>
          </div>

          <HeaderSearch
            transparent={transparent && !isScrolled}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            textColor={textColor}
          />

          <div className="relative flex items-center space-x-3" ref={menuRef}>
            {isLoggedIn ? (
              <>
                <Link
                  href={hasProfessionalRole ? "/new-project" : "/list-with-us"}
                  className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                >
                  {hasProfessionalRole ? "Add new project" : "List with us"}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center space-x-2 rounded-full border px-3 py-2 text-sm font-medium ${
                    transparent && !isScrolled
                      ? "border-white text-white hover:bg-white/10 hover:text-white"
                      : "border-black text-black hover:bg-gray-100"
                  }`}
                  aria-label="Open menu"
                  onClick={toggleMenu}
                >
                  <span className={textColor}>{menuLabel}</span>
                  <Menu className="h-5 w-5" />
                </Button>
              </>
            ) : shouldRenderAuthTrigger ? (
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 rounded-full border px-3 py-2 text-sm font-medium ${
                  transparent && !isScrolled
                    ? "border-white text-white hover:bg-white/10 hover:text-white"
                    : "border-black text-black hover:bg-gray-100"
                }`}
                aria-label="Open menu"
                onClick={toggleMenu}
              >
                <span className={textColor}>{authTriggerLabel}</span>
                <Menu className="h-5 w-5" />
              </Button>
            ) : null}

            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  {/* Section 1: Projects / Professionals */}
                  <div className="px-4 py-3">
                    <Link
                      href="/projects"
                      className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Projects
                    </Link>
                    <Link
                      href="/professionals"
                      className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Professionals
                    </Link>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-gray-100" />
                  
                  {/* Section 2: Login/Signup OR Saved projects/Saved professionals/Account */}
                  <div className="px-4 py-3">
                    {isLoggedIn ? (
                      <>
                        <Link
                          href="/homeowner?tab=saved-projects"
                          className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Saved projects
                        </Link>
                        <Link
                          href="/homeowner?tab=saved-professionals"
                          className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Saved professionals
                        </Link>
                        <Link
                          href="/homeowner?tab=settings"
                          className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Account
                        </Link>
                      </>
                    ) : (
                      <>
                        {shouldShowLoginLink && (
                          <Link
                            href={`/login${redirectQuery}`}
                            className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Login
                          </Link>
                        )}
                        {shouldShowSignupLink && (
                          <Link
                            href={`/signup${redirectQuery}`}
                            className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Sign up
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-gray-100" />
                  
                  {/* Section 3: List with us/Help center/Sign out */}
                  <div className="px-4 py-3">
                    {hasProfessionalRole ? (
                      <Link
                        href="/dashboard/listings"
                        className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Switch to company
                      </Link>
                    ) : (
                      <Link
                        href="/list-with-us"
                        className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        List with us
                      </Link>
                    )}
                    <Link
                      href="/help-center"
                      className="block w-full text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 py-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Help center
                    </Link>
                    {isLoggedIn && (
                      <button
                        type="button"
                        className="block w-full text-left text-sm text-red-600 transition-colors hover:bg-red-50 py-2"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? "Signing out..." : "Sign out"}
                      </button>
                    )}
                  </div>
                  
                  {/* Mobile search - only show on mobile */}
                  <div className="border-t border-gray-100 px-4 py-3 md:hidden">
                    <form onSubmit={handleSearch} className="relative">
                      <input
                        type="text"
                        placeholder="Search Arco"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
