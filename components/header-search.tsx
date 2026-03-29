"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("common");

  const trimmedQuery = searchQuery.trim();

  const suggestions = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }

    const encoded = encodeURIComponent(trimmedQuery);
    return [
      {
        label: t("in_projects", { query: trimmedQuery }),
        href: `/projects?search=${encoded}`,
      },
      {
        label: t("in_professionals", { query: trimmedQuery }),
        href: `/professionals?search=${encoded}`,
      },
    ];
  }, [trimmedQuery, t]);

  const showSuggestions = isFocused && suggestions.length > 0;

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

  return (
    <div
      ref={containerRef}
      className={`${containerClasses} ${className ?? ""}`}
    >
      <form
        onSubmit={(event) => {
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
          className={`w-full h-9 rounded-full border px-3 pr-8 text-sm focus:outline-none focus:ring-2 ${inputClasses}`}
        />
        <button
          type="submit"
          className={`absolute right-2 top-1/2 -translate-y-1/2 transform ${textColor} hover:opacity-70`}
        >
          <Search className="h-4 w-4" />
        </button>

        {showSuggestions && (
          <div className={`${baseDropdownClasses} ${dropdownClasses}`}>
            <ul>
              {suggestions.map((suggestion) => (
                <li key={suggestion.href}>
                  <Link
                    href={suggestion.href}
                    className="block px-4 py-3 text-sm font-medium transition-colors hover:bg-black/[0.05]"
                    onClick={() => setIsFocused(false)}
                  >
                    {suggestion.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
