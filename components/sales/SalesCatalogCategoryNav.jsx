'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { adminJson } from '@/lib/client/adminFetch';
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from '@/components/Icons';

const fetcher = (url) => adminJson(url);

function buildDepartments(topLevelCategories) {
  if (!topLevelCategories?.length) return [];

  const filtered = topLevelCategories.filter((cat) => {
    if (cat.level !== undefined) return cat.level === 'department';
    return true;
  });

  const list = filtered.length > 0 ? filtered : topLevelCategories;
  return list.map((cat) => ({
    ...cat,
    name: cat.name?.toUpperCase?.() ?? cat.name,
    id: cat._id || cat.id,
  }));
}

function CategoryIcon({ categorySlug, className = 'w-4 h-4' }) {
  const key = categorySlug?.includes('hospitality') ? 'hospitality' : categorySlug;
  const icons = {
    tableware: (
      <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M13.67 2.00067C13.14 2.00067 12.72 2.42067 12.72 2.94067V6.64067C12.72 6.91067 12.5 7.13067 12.23 7.13067 11.96 7.13067 11.74 6.91067 11.74 6.64067V2.98067C11.74 2.46067 11.34 2.01067 10.83 2.00067 10.3 1.98067 9.86 2.41067 9.86 2.94067V6.64067C9.86 6.91067 9.64 7.13067 9.37 7.13067 9.1 7.13067 8.88 6.91067 8.88 6.64067V2.98067C8.88 2.46067 8.48 2.01067 7.97 2.00067 7.44 1.98067 7 2.41067 7 2.94067V9.26067C7 10.5001 7.5894 11.5997 8.50296 12.2944 9.35 12.9134 9.35 14.9107 9.35 14.9107V28.7107C9.35 29.4207 9.93 30.0007 10.64 30.0007H10.96C11.67 30.0007 12.25 29.4207 12.25 28.7107V14.9007C12.25 14.9007 12.25 12.8644 13.0838 12.2944 14.0049 11.6003 14.6 10.4961 14.6 9.25067V2.94067C14.61 2.42067 14.19 2.00067 13.67 2.00067ZM23.06 2.00061C24.3 2.00061 25.3 3.00061 25.3 4.24061V17.8906L25.29 17.887V28.7006C25.29 29.4106 24.71 29.9906 24 29.9906H23.68C22.97 29.9906 22.39 29.4106 22.39 28.7006V16.8369C20.8453 16.1365 19.84 14.591 19.84 12.8706V5.22061C19.83 3.44061 21.28 2.00061 23.06 2.00061Z" />
      </svg>
    ),
    kitchenware: (
      <svg className={className} viewBox="-3 0 75 122.88" fill="currentColor" aria-hidden="true">
        <path d="M6.14,0H65.4c1.69,0,3.23,0.69,4.34,1.8c1.11,1.11,1.8,2.65,1.8,4.34v29.67v73.73c0,1.69-0.69,3.23-1.8,4.34 c-1.11,1.11-2.65,1.8-4.34,1.8H6.14c-1.69,0-3.23-0.69-4.34-1.8c-1.11-1.11-1.8-2.65-1.8-4.34V35.81V6.14C0,4.45,0.69,2.91,1.8,1.8C2.91,0.69,4.45,0,6.14,0L6.14,0z M12.2,44.89c0-1.34,1.09-2.43,2.43-2.43 c1.34,0,2.43,1.09,2.43,2.43v20.4c0,1.34-1.09,2.43-2.43,2.43c-1.34,0-2.43-1.09-2.43-2.43V44.89L12.2,44.89z M12.2,10.39 c0-1.34,1.09-2.43,2.43-2.43c1.34,0,2.43,1.09,2.43,2.43v15.15c0,1.34-1.09,2.43-2.43,2.43c-1.34,0-2.43-1.09-2.43-2.43V10.39 L12.2,10.39z M4.87,33.37h61.81V6.14c0-0.35-0.14-0.67-0.38-0.9c-0.23-0.23-0.55-0.38-0.9-0.38H6.14c-0.35,0-0.67,0.14-0.9,0.38 c-0.23,0.23-0.38,0.55-0.38,0.9V33.37L4.87,33.37z M66.67,38.24H4.87v71.29c0,0.35,0.14,0.67,0.38,0.9 c0.23,0.23,0.55,0.38,0.9,0.38H65.4c0.35,0,0.67-0.14,0.9-0.38c0.23-0.23,0.38-0.55,0.38-0.9V38.24L66.67,38.24z" />
      </svg>
    ),
    hospitality: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7,12.5a3,3,0,1,0-3-3A3,3,0,0,0,7,12.5Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,7,8.5Zm13-2H12a1,1,0,0,0-1,1v6H3v-8a1,1,0,0,0-2,0v13a1,1,0,0,0,2,0v-3H21v3a1,1,0,0,0,2,0v-9A3,3,0,0,0,20,6.5Zm1,7H13v-5h7a1,1,0,0,1,1,1Z" />
      </svg>
    ),
    catering: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="0.8" ry="0.5" />
        <rect x="11.2" y="6" width="1.6" height="0.6" />
        <path d="M5,14 Q5,8 12,8 T19,14" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="4.5" y1="14" x2="19.5" y2="14" stroke="currentColor" strokeWidth="1.2" />
        <rect x="4" y="16" width="16" height="1.2" rx="0.6" />
      </svg>
    ),
    barware: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m12 12 7-8H5l7 8Zm0 0v8m-3 0h6M8.54939 8h6.95051" />
      </svg>
    ),
  };
  return icons[key] || icons.tableware;
}

function itemId(item) {
  return String(item._id || item.id || item.slug);
}

export default function SalesCatalogCategoryNav({ selectedSlug, onSelect }) {
  const { data, isLoading } = useSWR('/api/admin/categories?tree=true', fetcher, {
    revalidateOnFocus: false,
  });

  const departments = useMemo(() => buildDepartments(data?.categories || []), [data]);

  const [navStack, setNavStack] = useState(null);
  const [openAccordions, setOpenAccordions] = useState({});

  useEffect(() => {
    if (departments.length > 0) {
      setNavStack([{ id: 'root', name: 'Categories', children: departments }]);
    }
  }, [departments]);

  const handleNavForward = useCallback((menu) => {
    setNavStack((prev) => [
      ...(prev || []),
      { id: itemId(menu), name: menu.name, slug: menu.slug, children: menu.children || [] },
    ]);
  }, []);

  const handleNavBack = useCallback(() => {
    setNavStack((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const toggleAccordion = useCallback((id) => {
    setOpenAccordions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectCategory = useCallback(
    (slug) => {
      onSelect?.(slug || '');
    },
    [onSelect]
  );

  const currentMenu = navStack?.[navStack.length - 1];
  const isDrilled = navStack && navStack.length > 1;

  if (isLoading && !departments.length) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">Loading categories…</p>
      </div>
    );
  }

  if (!departments.length) return null;

  return (
    <div className="pt-3 mt-1 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold text-gray-800 uppercase tracking-widest">
          Browse by category
        </h3>
        {selectedSlug && (
          <button
            type="button"
            onClick={() => selectCategory('')}
            className="text-[10px] uppercase tracking-wider text-gray-600 hover:text-gray-900 underline"
          >
            All
          </button>
        )}
      </div>

      {isDrilled ? (
          <>
            <button
              type="button"
              onClick={handleNavBack}
              className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-gray-500 hover:text-gray-800 py-2 px-1 border-b border-gray-100"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5 shrink-0" />
              Back to {navStack[navStack.length - 2]?.name || 'Categories'}
            </button>

            {currentMenu?.slug && (
              <button
                type="button"
                onClick={() => selectCategory(currentMenu.slug)}
                className={`w-full text-left py-2 px-1 text-xs font-medium border-b border-gray-100 ${
                  selectedSlug === currentMenu.slug
                    ? 'text-black bg-gray-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All in {currentMenu.name}
              </button>
            )}

            <div className="py-1">
              {(currentMenu?.children || []).map((item) => {
                const id = itemId(item);
                const hasChildren = item.children?.length > 0;
                const isSelected = selectedSlug === item.slug;

                if (hasChildren) {
                  return (
                    <div key={id} className="border-b border-gray-50">
                      <button
                        type="button"
                        onClick={() => toggleAccordion(id)}
                        className="flex items-center justify-between w-full py-2 px-1 text-left hover:bg-gray-50"
                      >
                        <span className="text-xs font-medium text-gray-800 uppercase tracking-wide truncate pr-2">
                          {item.name}
                        </span>
                        <ChevronDownIcon
                          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${
                            openAccordions[id] ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {openAccordions[id] && (
                        <div className="bg-gray-50 py-1 pl-2 space-y-0.5">
                          <button
                            type="button"
                            onClick={() => selectCategory(item.slug)}
                            className={`block w-full text-left py-1.5 px-2 text-xs border-l-2 ${
                              isSelected
                                ? 'text-black border-black font-medium'
                                : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                            }`}
                          >
                            All {item.name}
                          </button>
                          {item.children.map((sub) => (
                            <button
                              key={itemId(sub)}
                              type="button"
                              onClick={() => selectCategory(sub.slug)}
                              className={`block w-full text-left py-1.5 px-2 text-xs border-l-2 ${
                                selectedSlug === sub.slug
                                  ? 'text-black border-black font-medium'
                                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                              }`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectCategory(item.slug)}
                    className={`flex items-center w-full py-2 px-1 text-left text-xs font-medium border-b border-gray-50 hover:bg-gray-50 ${
                      isSelected ? 'text-black bg-gray-50' : 'text-gray-800'
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-1">
            {departments.map((dept) => {
              const deptSlug = dept.slug;
              const id = itemId(dept);
              const hasChildren = dept.children?.length > 0;
              const isSelected = selectedSlug === deptSlug;

              if (hasChildren) {
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleNavForward(dept)}
                    className="flex items-center justify-between w-full py-2 px-1 text-left hover:bg-gray-50 border-b border-gray-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIcon categorySlug={deptSlug} className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="text-xs font-medium text-gray-800 uppercase truncate">{dept.name}</span>
                    </div>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </button>
                );
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCategory(deptSlug)}
                  className={`flex items-center gap-2 w-full py-2 px-1 text-left border-b border-gray-50 hover:bg-gray-50 ${
                    isSelected ? 'bg-gray-50' : ''
                  }`}
                >
                  <CategoryIcon categorySlug={deptSlug} className="w-4 h-4 text-gray-500 shrink-0" />
                  <span
                    className={`text-xs font-medium truncate ${
                      isSelected ? 'text-black' : 'text-gray-800'
                    }`}
                  >
                    {dept.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
