"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ChevronDownIcon } from "@/components/Icons";
import { useAppContext } from "@/context/AppContext";

export default function SearchBar({ className = "", placeholder = "What are you looking for" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories } = useAppContext();

  const [query, setQuery] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // 🔥 Load existing ?search=value when on catalog
  useEffect(() => {
    const existing = searchParams.get("search") || "";
    setQuery(existing);
    
    // Set selected category based on URL
    const categoryParam = searchParams.get("category");
    if (categoryParam && categories.length > 0) {
      const category = categories.find(c => c.slug === categoryParam);
      if (category) {
        setSelectedCategory(category.name);
      }
    } else {
      setSelectedCategory("All Categories");
    }
  }, [searchParams, categories]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Get top-level categories (no parent)
  const topLevelCategories = categories.filter(cat => {
    const parent = cat.parent?._id || cat.parent;
    return !parent;
  });

  // 🔥 Same functionality as your old Header
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("search", trimmed);
    // Remove category when searching
    newParams.delete("category");

    router.push(`/catalog?${newParams.toString()}`);
    setSelectedCategory("All Categories");
  };

  const handleCategorySelect = (category) => {
    if (category === null) {
      // "All Categories" selected
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("category");
      router.push(`/catalog?${newParams.toString()}`);
      setSelectedCategory("All Categories");
    } else {
      // Specific category selected
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("category", category.slug);
      newParams.delete("search"); // Clear search when selecting category
      router.push(`/catalog?${newParams.toString()}`);
      setSelectedCategory(category.name);
      setQuery(""); // Clear search query
    }
    setIsCategoryDropdownOpen(false);
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative flex items-center gap-2">
        {/* All Categories Dropdown Button */}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-black/5 text-black rounded-lg text-sm font-medium transition-colors border border-black/20 shadow-sm whitespace-nowrap"
          >
            <span>{selectedCategory}</span>
            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isCategoryDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 mt-1 w-[280px] max-h-[400px] bg-white border  border-black/20 rounded-lg shadow-lg z-50 overflow-hidden"
            >
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                {/* All Categories Option */}
                <button
                  type="button"
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    selectedCategory === "All Categories"
                      ? "bg-accent text-white font-medium"
                      : "text-black hover:bg-black/5"
                  }`}
                >
                  All Categories
                </button>

                {/* Category List */}
                {topLevelCategories.length > 0 ? (
                  topLevelCategories.map((category) => (
                    <button
                      key={category._id || category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        selectedCategory === category.name
                          ? "bg-accent text-white font-medium"
                          : "text-black hover:bg-black/5"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-black/60">No categories available</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="flex items-center flex-1 rounded-full border border-black/20 bg-white px-3 py-2 shadow-sm focus-within:border-accent focus-within:bg-white transition-all duration-200">
          {/* Search Icon */}
          <Search className="w-4 h-4 mr-2 text-black/60" />

          {/* Input Field */}
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm md:text-[15px] placeholder:text-black/40 text-black"
          />

          {/* Search Button */}
          <button
            type="submit"
            className="ml-2 px-3 py-1 rounded-full text-xs md:text-sm font-medium border border-accent bg-accent text-white hover:bg-white hover:text-accent transition-colors"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
