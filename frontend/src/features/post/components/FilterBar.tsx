"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { COMMUNITY_CATEGORIES } from "@/features/post/components/communityCategories";

const categories = COMMUNITY_CATEGORIES;

interface Props {
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  sortType: "latest" | "popular";
  onSortChange: (value: "latest" | "popular") => void;
  searchKeyword: string;
  onSearchChange: (value: string) => void;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = (matches: boolean) => {
      setIsMobile(matches);
    };

    update(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      update(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [breakpoint]);

  return isMobile;
}

export default function FilterBar({
  selectedFilter,
  onFilterChange,
  sortType,
  onSortChange,
  searchKeyword,
  onSearchChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="mb-1">
      <div
        className={`flex ${
          isMobile ? "flex-col gap-3" : "items-center justify-between"
        }`}
      >
        {isMobile ? (
          <div className="flex items-center gap-2">
            <div className="relative min-w-[96px]">
              <select
                value={selectedFilter}
                onChange={(e) => onFilterChange(e.target.value)}
                className="
                  h-10 w-full appearance-none rounded-full border border-[#E5E7EB]
                  bg-[#F3F4F6] px-4 pr-9 text-[13px] text-[#050000]
                  focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]
                "
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>

              <Image
                src="/icons/filter.svg"
                alt="filter"
                width={14}
                height={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
              />
            </div>

            <div className="relative flex-1">
              <Image
                src="/icons/search.svg"
                alt="search"
                width={15}
                height={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
              />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="검색"
                className="
                  h-10 w-full rounded-full border border-[#E5E7EB]
                  pl-9 pr-3 text-[13px] text-[#364153]
                  focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]
                "
              />
            </div>

            <div className="relative shrink-0 text-[13px]">
              <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex h-10 items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-3 text-[#364153]"
              >
                {sortType === "latest" ? "최신순" : "인기순"}
                <Image
                  src="/icons/filter.svg"
                  alt="filter"
                  width={16}
                  height={16}
                />
              </button>

              {isOpen && (
                <div className="absolute right-0 z-50 mt-2 w-24 rounded-md border border-[#E5E7EB] bg-white shadow-md">
                  <button
                    onClick={() => {
                      onSortChange("latest");
                      setIsOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                  >
                    최신순
                  </button>

                  <button
                    onClick={() => {
                      onSortChange("popular");
                      setIsOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                  >
                    인기순
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1">
              {categories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => onFilterChange(category.value)}
                  className={`
                    rounded-full px-3 py-1 text-[13px] leading-[20px]
                    transition
                    ${
                      selectedFilter === category.value
                        ? "bg-[#2B7FFF] text-white"
                        : "bg-[#F3F4F6] text-[#050000]"
                    }
                  `}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/icons/search.svg"
                  alt="search"
                  width={15}
                  height={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="검색"
                  className="
                    w-[200px]
                    rounded-lg border border-[#E5E7EB]
                    py-1 pl-9 pr-3
                    text-[13px] text-[#364153]
                    focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]
                  "
                />
              </div>

              <div className="relative text-[13px]">
                <button
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="flex items-center gap-1 text-[#364153]"
                >
                  {sortType === "latest" ? "최신순" : "인기순"}
                  <Image
                    src="/icons/filter.svg"
                    alt="filter"
                    width={16}
                    height={16}
                  />
                </button>

                {isOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-24 rounded-md border border-[#E5E7EB] bg-white shadow-md">
                    <button
                      onClick={() => {
                        onSortChange("latest");
                        setIsOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                    >
                      최신순
                    </button>

                    <button
                      onClick={() => {
                        onSortChange("popular");
                        setIsOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                    >
                      인기순
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 border-b border-[#E5E7EB]" />
    </div>
  );
}