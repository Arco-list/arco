"use client";

import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { trackSearch } from "@/lib/tracking";
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security";

type SearchResult = {
  projects: Array<{ id: string; title: string; slug: string; location: string | null; photo: string | null; category: string | null }>;
  professionals: Array<{ id: string; name: string; slug: string; logo: string | null; city: string | null; service: string | null }>;
};

type HeaderSearchProps = {
  transparent?: boolean;
  centered?: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  textColor: string;
  className?: string;
};

const baseDropdownClasses =
  "absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border shadow-xl";

export function HeaderSearch({
  transparent = false,
  searchQuery,
  setSearchQuery,
  onSearch,
  textColor,
  className,
  centered = true,
}: HeaderSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult>({ projects: [], professionals: [] });
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations("common");

  const trimmedQuery = searchQuery.trim();

  const fetchResults = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults({ projects: [], professionals: [] });
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {}
      setIsLoading(false);
    }, 250);
  }, []);

  useEffect(() => {
    fetchResults(trimmedQuery);
  }, [trimmedQuery, fetchResults]);

  const hasResults = results.projects.length > 0 || results.professionals.length > 0;
  const showDropdown = isFocused && trimmedQuery.length >= 2;

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const inputClasses = transparent
    ? "border-white/20 bg-white/10 text-white placeholder-white/70 backdrop-blur-sm focus:ring-red-200/60"
    : "border-border bg-white text-black placeholder-gray-500 focus:ring-red-500";

  const dropdownClasses = transparent
    ? "border-white/20 bg-white/90 text-black backdrop-blur"
    : "border-border bg-white text-foreground";

  const containerClasses = centered
    ? "absolute left-1/2 w-48 -translate-x-1/2 transform md:left-[55%] md:w-40 lg:left-1/2 lg:w-64"
    : "w-48 md:w-40 lg:w-64";

  const encoded = encodeURIComponent(trimmedQuery);

  return (
    <div
      ref={containerRef}
      className={`${containerClasses} ${className ?? ""}`}
    >
      <form
        onSubmit={(event) => {
          if (trimmedQuery) trackSearch(trimmedQuery, 0);
          onSearch(event);
          setIsFocused(false);
        }}
        className="relative"
      >
        <input
          type="text"
          placeholder={t("search_arco")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          className={`w-full h-9 rounded-full border px-3 pr-8 text-sm max-md:text-base focus:outline-none focus:ring-2 ${inputClasses}`}
        />
        <button
          type="submit"
          className={`absolute right-2 top-1/2 -translate-y-1/2 transform ${textColor} hover:opacity-70`}
        >
          <Search className="h-4 w-4" />
        </button>

        {showDropdown && (
          <div className={`${baseDropdownClasses} ${dropdownClasses}`} style={{ minWidth: "min(320px, calc(100vw - 40px))" }}>
            {isLoading && !hasResults && (
              <div className="px-4 py-3 text-xs text-[#a1a1a0]">Searching…</div>
            )}

            {/* Projects */}
            {results.projects.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Projects</span>
                </div>
                {results.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.03] transition-colors"
                    onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                  >
                    {p.photo ? (
                      <Image
                        src={sanitizeImageUrl(p.photo, IMAGE_SIZES.thumbnail)}
                        alt={p.title}
                        width={36}
                        height={36}
                        className="rounded-[3px] object-cover shrink-0"
                        style={{ width: 36, height: 36 }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-[3px] bg-[#f5f5f4] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1c1c1a] truncate">{p.title}</p>
                      {(p.location || p.category) && (
                        <p className="text-xs text-[#a1a1a0] truncate">{[p.category, p.location].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/projects?search=${encoded}`}
                  className="block px-4 py-2 text-xs font-medium text-[#016D75] hover:bg-black/[0.03] transition-colors"
                  onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                >
                  {t("search_all_projects")}
                </Link>
              </div>
            )}

            {/* Professionals */}
            {results.professionals.length > 0 && (
              <div className={results.projects.length > 0 ? "border-t border-[#e5e5e4]" : ""}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Professionals</span>
                </div>
                {results.professionals.map((p) => (
                  <Link
                    key={p.id}
                    href={`/professionals/${p.slug}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.03] transition-colors"
                    onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                  >
                    {p.logo ? (
                      <Image
                        src={sanitizeImageUrl(p.logo, IMAGE_SIZES.thumbnail)}
                        alt={p.name}
                        width={36}
                        height={36}
                        className="rounded-full object-cover shrink-0"
                        style={{ width: 36, height: 36 }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#f5f5f4] shrink-0 flex items-center justify-center text-xs font-medium text-[#6b6b68]">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1c1c1a] truncate">{p.name}</p>
                      {(p.service || p.city) && (
                        <p className="text-xs text-[#a1a1a0] truncate">{[p.service, p.city].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/professionals?search=${encoded}`}
                  className="block px-4 py-2 text-xs font-medium text-[#016D75] hover:bg-black/[0.03] transition-colors"
                  onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                >
                  {t("search_all_professionals")}
                </Link>
              </div>
            )}

            {/* No results */}
            {!isLoading && !hasResults && trimmedQuery.length >= 2 && (
              <div className="px-4 py-3">
                <p className="text-xs text-[#a1a1a0] mb-2">No results found</p>
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/projects?search=${encoded}`}
                    className="text-xs font-medium text-[#016D75] hover:underline"
                    onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                  >
                    {t("search_all_projects")}
                  </Link>
                  <Link
                    href={`/professionals?search=${encoded}`}
                    className="text-xs font-medium text-[#016D75] hover:underline"
                    onClick={() => { trackSearch(trimmedQuery, 0); setIsFocused(false); }}
                  >
                    {t("search_all_professionals")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
