"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Package, ArrowRight, Loader2 } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

// Constants
const DEBOUNCE_DELAY = 300;
const MAX_RESULTS = 6;

export default function SearchBar({ className = "", placeholder = "What are you looking for" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories } = useAppContext();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [imageErrors, setImageErrors] = useState(new Set());

  const searchBarRef = useRef(null);
  const resultsRef = useRef(null);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Load existing ?search=value when on catalog
  useEffect(() => {
    const existing = searchParams.get("search") || "";
    setQuery(existing);
  }, [searchParams]);

  // Relevance scoring function
  const calculateRelevance = useCallback((product, queryLower) => {
    let score = 0;
    const title = (product.title || product.name || "").toLowerCase();
    const sku = (product.sku || "").toLowerCase();
    const brand = (product.brand || "").toLowerCase();
    const description = (product.description || "").toLowerCase();
    const summary = (product.summary || "").toLowerCase();
    const categoryName = (product.category?.name || "").toLowerCase();
    const tags = (product.tags || []).map(t => t.toLowerCase());

    // Exact matches get highest score
    if (title === queryLower || sku === queryLower) score += 100;
    // Title starts with query
    else if (title.startsWith(queryLower)) score += 50;
    // SKU starts with query
    else if (sku.startsWith(queryLower)) score += 45;
    // Title contains query
    else if (title.includes(queryLower)) score += 30;
    // Brand matches
    else if (brand.includes(queryLower)) score += 25;
    // SKU contains query
    else if (sku.includes(queryLower)) score += 20;
    // Tags match
    else if (tags.some(tag => tag.includes(queryLower))) score += 15;
    // Category matches
    else if (categoryName.includes(queryLower)) score += 10;
    // Description/summary matches (lower priority)
    else if (description.includes(queryLower) || summary.includes(queryLower)) score += 5;

    return score;
  }, []);

  // Handle Search logic with server-side API call
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setSelectedIndex(-1);

    timeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;

      try {
        const params = new URLSearchParams({
          search: query.trim(),
          limit: String(MAX_RESULTS),
        });

        const response = await fetch(`/api/products?${params.toString()}`);
        const data = await response.json();
        
        if (isMountedRef.current && data.success) {
          // Sort results by relevance (title matches first, then brand, etc.)
          const sortedResults = (data.products || []).sort((a, b) => {
            const queryLower = query.toLowerCase().trim();
            const aTitle = (a.title || '').toLowerCase();
            const bTitle = (b.title || '').toLowerCase();
            const aBrand = (a.brand || '').toLowerCase();
            const bBrand = (b.brand || '').toLowerCase();
            
            // Exact title match gets highest priority
            if (aTitle === queryLower && bTitle !== queryLower) return -1;
            if (bTitle === queryLower && aTitle !== queryLower) return 1;

            // Title starts with query
            if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
            if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;
            
            // Title contains query
            if (aTitle.includes(queryLower) && !bTitle.includes(queryLower)) return -1;
            if (bTitle.includes(queryLower) && !aTitle.includes(queryLower)) return 1;
            
            // Brand match
            if (aBrand.includes(queryLower) && !bBrand.includes(queryLower)) return -1;
            if (bBrand.includes(queryLower) && !aBrand.includes(queryLower)) return 1;
            
            return 0;
          });
          
          setSearchResults(sortedResults);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (isMountedRef.current) {
          setSearchResults([]);
        }
      } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
        }
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchBarRef.current && 
        !searchBarRef.current.contains(event.target) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Handle search results navigation
      if (showResults && searchResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault();
          const product = searchResults[selectedIndex];
          const productSlug = product?.slug || product?._id || product?.id;
          if (productSlug) {
            router.push(`/products/${productSlug}`);
            setShowResults(false);
            setSelectedIndex(-1);
          }
        } else if (e.key === "Escape") {
          setShowResults(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResults, searchResults, selectedIndex, router]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-result-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setShowResults(false);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("search", trimmed);
    newParams.delete("category");

    router.push(`/catalog?${newParams.toString()}`);
  };

  const clearSearch = () => {
    setQuery("");
    setSearchResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    setImageErrors(new Set());
    inputRef.current?.focus();
  };

  const handleImageError = useCallback((productId) => {
    setImageErrors(prev => new Set([...prev, productId]));
  }, []);

  const handleResultClick = useCallback(() => {
    setShowResults(false);
    setSelectedIndex(-1);
  }, []);

  return (
    <div ref={searchBarRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center rounded-md border-2 border-accent bg-white hover:border-accent/80 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all duration-300">


          {/* Search Input Section */}
          <div className="flex items-center flex-1 px-2.5 py-1.5">
            <Search className={`w-3.5 h-3.5 mr-2 transition-colors ${isSearching ? 'text-accent animate-pulse' : 'text-black/30'}`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim()) {
                  setShowResults(true);
                }
              }}
              onFocus={() => query.trim() && !loading && products.length > 0 && setShowResults(true)}
              className="flex-1 bg-transparent outline-none text-xs placeholder:text-black/70 text-black"
              aria-label="Search products"
              aria-autocomplete="list"
              aria-expanded={showResults && query.trim() ? "true" : "false"}
              aria-controls="search-results"
              role="combobox"
            />

            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-0.5 hover:bg-black/5 rounded-full transition-colors mr-1"
              >
                <X className="w-3 h-3 text-black/40" />
              </button>
            )}

            <button
              type="submit"
              className="ml-1.5 bg-accent text-white px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-accent/90 transition-all active:scale-95"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Live Search Results Dropdown */}
      <AnimatePresence>
        {showResults && query.trim() && (
          <motion.div
            ref={resultsRef}
            id="search-results"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-black/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 overflow-hidden"
            role="listbox"
            aria-label="Search results"
          >
            <div className="p-2">
              {isSearching ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-accent animate-spin mb-2" />
                  <span className="text-xs text-black/40 font-medium">Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="px-3 py-2 flex items-center justify-between border-b border-black/5 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Product Suggestions</span>
                    <span className="text-[9px] font-bold text-accent px-1.5 py-0.5 bg-accent/5 rounded-full">
                      {searchResults.length} Match{searchResults.length !== 1 ? 'es' : ''}
                    </span>
                  </div>

                  <div className="space-y-1" role="list">
                    {searchResults.map((product, index) => {
                      const productId = product._id || product.id;
                      const productName = product.title || product.name || "Product";
                      const productImage = product.heroImage || product.images?.[0]?.url || product.images?.[0];
                      const isSelected = selectedIndex === index;
                      const hasImageError = imageErrors.has(productId);
                      // Always use slug for navigation - fallback to ID only if slug is missing
                      const productSlug = product.slug ? product.slug : (productId?.toString() || '');

                      return (
                        <Link
                          key={productId}
                          data-result-index={index}
                          href={`/products/${productSlug}`}
                          onClick={handleResultClick}
                          className={`flex items-center gap-4 p-2.5 rounded-xl transition-all group ${
                            isSelected 
                              ? "bg-accent/10 border border-accent/20" 
                              : "hover:bg-gray-50"
                          }`}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setSelectedIndex(index)}
                        >
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-black/5 flex-shrink-0">
                            {productImage && !hasImageError ? (
                              <Image
                                src={productImage}
                                alt={productName}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                onError={() => handleImageError(productId)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-black/10" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-black truncate group-hover:text-accent transition-colors">
                              {productName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {product.brand && (
                                <>
                                  <span className="text-[11px] text-black/50 font-medium">
                                    {product.brand}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-black/10" />
                                </>
                              )}
                              <span className="text-[11px] text-black/40 font-medium">
                                {product.category?.name || "Uncategorized"}
                              </span>
                            </div>
                          </div>
                          <div className={`opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${isSelected ? 'opacity-100 translate-x-0' : ''}`}>
                            <ArrowRight className="w-4 h-4 text-accent" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleSubmit}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 text-[11px] font-black uppercase tracking-widest text-accent hover:bg-accent hover:text-white transition-all rounded-xl border-t border-black/5"
                  >
                    View All Results for "{query}"
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-black/10" />
                  </div>
                  <h3 className="text-sm font-bold text-black mb-1">No matches found</h3>
                  <p className="text-xs text-black/40 max-w-[200px] leading-relaxed">
                    We couldn't find any products matching "{query}". Try a different term or check your spelling.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
