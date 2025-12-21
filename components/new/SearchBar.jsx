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
      <div className="relative flex items-center rounded-lg border border-black/5 bg-gray-50 hover:border-black/20 focus-within:border-accent focus-within:bg-white focus-within:ring-1 focus-within:ring-accent transition-all duration-300">

        {/* All Categories Dropdown Button */}
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="flex items-center gap-2 pl-4 pr-3 py-3 text-black hover:text-accent text-sm font-bold uppercase tracking-wider transition-colors outline-none whitespace-nowrap"
          >
            <span>{selectedCategory}</span>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-black/40 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isCategoryDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-[calc(100%+8px)] left-0 w-[240px] max-h-[400px] bg-white border border-black/5 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar p-1">
                <button
                  type="button"
                  onClick={() => handleCategorySelect(null)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg ${selectedCategory === "All Categories"
                    ? "bg-accent text-white font-medium"
                    : "text-black/70 hover:bg-gray-50 hover:text-black"
                    }`}
                >
                  All Categories
                </button>

                {topLevelCategories.length > 0 ? (
                  topLevelCategories.map((category) => (
                    <button
                      key={category._id || category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg ${selectedCategory === category.name
                        ? "bg-accent text-white font-medium"
                        : "text-black/70 hover:bg-gray-50 hover:text-black"
                        }`}
                    >
                      {category.name}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-black/40">No categories</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Elegant Vertical Divider */}
        <div className="h-5 w-px bg-black/10 mx-1" />

        {/* Search Input Section */}
        <div className="flex items-center flex-1 px-3 py-2">
          <Search className="w-4 h-4 mr-3 text-black/30" />
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-black/30 text-black tracking-wide"
          />
          <button
            type="submit"
            className="ml-2 bg-accent text-white px-5 py-2 rounded-md text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-accent/90 transition-all shadow-sm shadow-accent/20"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
