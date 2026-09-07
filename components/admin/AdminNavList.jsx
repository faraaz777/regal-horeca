'use client';

import Link from 'next/link';
import { ChevronDown, Package } from 'lucide-react';
import { isNavItemActive } from '@/lib/admin/navConfig';

/**
 * Grouped sidebar links. Section labels are headings, not pages —
 * collapsing a group hides its links without changing the route.
 */
export default function AdminNavList({
  sections,
  expanded,
  pathname,
  navHrefs,
  newEnquiriesCount,
  closeOnMobile,
  navLinkClass,
  iconClass,
  icons,
  collapsedIds,
  toggleSection,
}) {
  return (
    <>
      {sections.map((section, sectionIndex) => {
        const hasLabel = Boolean(section.label);
        const isCollapsed = hasLabel && collapsedIds.has(section.id);
        const headingId = `nav-section-${section.id}`;

        return (
          <div key={section.id}>
            {!expanded && sectionIndex > 0 && (
              <div className="mx-1 my-2 h-px bg-shell-border" aria-hidden />
            )}

            {expanded && hasLabel && (
              <button
                type="button"
                id={headingId}
                onClick={() => toggleSection(section.id)}
                aria-expanded={!isCollapsed}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-shell-raised/70 ${
                  sectionIndex === 0 ? 'mt-0' : 'mt-3'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-gold/80">
                  {section.label}
                </span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 text-shell-dim transition-transform duration-200 ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                  aria-hidden
                />
              </button>
            )}

            <div
              role={hasLabel ? 'group' : undefined}
              aria-labelledby={hasLabel && expanded ? headingId : undefined}
              hidden={expanded && isCollapsed}
              className="space-y-0.5"
            >
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href, navHrefs);
                const Icon = icons[item.href] || Package;
                const showEnquiryBadge = item.href === '/admin/enquiries' && newEnquiriesCount > 0;

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeOnMobile}
                      title={item.label}
                      className={navLinkClass(isActive)}
                    >
                      <Icon
                        size={17}
                        strokeWidth={isActive ? 2.25 : 1.75}
                        className={iconClass(isActive)}
                      />
                      {expanded && (
                        <span className="flex-1 truncate text-[13px]">{item.label}</span>
                      )}
                      {showEnquiryBadge && (
                        <span
                          className={`text-[10px] font-bold rounded-full tabular-nums bg-accent text-white ${
                            expanded
                              ? 'ml-1 px-1.5 py-0.5'
                              : 'absolute top-1 right-1 px-1 min-w-[1rem] text-center leading-4'
                          }`}
                        >
                          {newEnquiriesCount}
                        </span>
                      )}
                    </Link>

                    {expanded && item.children?.length > 0 && (
                      <div className="mt-0.5 ml-4 space-y-0.5 border-l border-shell-border pl-3">
                        {item.children.map((child) => {
                          const childActive = isNavItemActive(pathname, child.href, navHrefs);
                          const ChildIcon = icons[child.href];
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeOnMobile}
                              title={child.label}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                                childActive
                                  ? 'bg-shell-raised text-shell-text'
                                  : 'text-shell-dim hover:bg-shell-raised/60 hover:text-shell-muted'
                              }`}
                            >
                              {ChildIcon ? (
                                <ChildIcon
                                  size={13}
                                  strokeWidth={1.75}
                                  className="shrink-0 text-shell-gold/80"
                                />
                              ) : null}
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {!expanded &&
                      item.children?.map((child) => {
                        const childActive = isNavItemActive(pathname, child.href, navHrefs);
                        const ChildIcon = icons[child.href] || Package;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={closeOnMobile}
                            title={child.label}
                            className={navLinkClass(childActive)}
                          >
                            <ChildIcon
                              size={17}
                              strokeWidth={childActive ? 2.25 : 1.75}
                              className={iconClass(childActive)}
                            />
                          </Link>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
