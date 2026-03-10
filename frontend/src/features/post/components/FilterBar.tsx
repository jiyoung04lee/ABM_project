"use client";

import Image from "next/image";
import { useState } from "react";
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

export default function FilterBar({
  selectedFilter,
  onFilterChange,
  sortType,
  onSortChange,
  searchKeyword,
  onSearchChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-1">
      <div className="flex justify-between items-center">

        {/* 카테고리 */}
        <div className="flex gap-1">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => onFilterChange(category.value)}
              className={`
                px-3 py-1 rounded-full text-[13px] leading-[20px]
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

        {/* 검색 + 정렬 */}
        <div className="flex items-center gap-3">

          {/* 검색 */}
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
                pl-9 pr-3 py-1
                text-[13px] text-[#364153]
                border border-[#E5E7EB]
                rounded-lg
                focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]
              "
            />
          </div>

          {/* 정렬 */}
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
              <div className="absolute right-0 mt-2 w-24 bg-white border border-[#E5E7EB] rounded-md shadow-md z-50">
                <button
                  onClick={() => {
                    onSortChange("latest");
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                >
                  최신순
                </button>

                <button
                  onClick={() => {
                    onSortChange("popular");
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                >
                  인기순
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 border-b border-[#E5E7EB]" />
    </div>
  );
}