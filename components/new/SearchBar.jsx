"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export default function SearchBar({ className = "", placeholder = "Search products..." }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");

  // 🔥 Load existing ?search=value when on catalog
  useEffect(() => {
    const existing = searchParams.get("search") || "";
    setQuery(existing);
  }, [searchParams]);

  // 🔥 Same functionality as your old Header
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("search", trimmed);

    router.push(`/catalog?${newParams.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative flex items-center">
        <div className="flex items-center w-full rounded-full border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm focus-within:border-black focus-within:bg-white transition-all duration-200">
          
          {/* Search Icon */}
          <Search className="w-4 h-4 mr-2 text-gray-500" />

          {/* Input Field */}
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm md:text-[15px] placeholder:text-gray-400"
          />

          {/* Search Button */}
          <button
            type="submit"
            className="ml-2 px-3 py-1 rounded-full text-xs md:text-sm font-medium border border-black bg-black text-white hover:bg-white hover:text-black transition-colors"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
