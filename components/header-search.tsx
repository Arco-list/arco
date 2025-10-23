"use client";

import Link from "next/link";
import { Search } from "lucide-react";
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

  const trimmedQuery = searchQuery.trim();

  const suggestions = useMemo(() => {
    if (!trimmedQuery) {
      return [];
    }

    const encoded = encodeURIComponent(trimmedQuery);
    return [
      {
        label: `${trimmedQuery} in Projects`,
        href: `/projects?search=${encoded}`,
      },
      {
        label: `${trimmedQuery} in Professionals`,
        href: `/professionals?search=${encoded}`,
      },
    ];
  }, [trimmedQuery]);

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
    : "border-gray-300 bg-white text-black placeholder-gray-500 focus:ring-red-500";

  const dropdownClasses = transparent
    ? "border-white/20 bg-white/90 text-black backdrop-blur"
    : "border-gray-200 bg-white text-gray-900";

  const containerClasses = centered
    ? "absolute left-1/2 w-60 -translate-x-1/2 transform md:w-80"
    : "w-60 md:w-80";

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
          placeholder="Search Arco"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          className={`w-full rounded-full border px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 ${inputClasses}`}
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
