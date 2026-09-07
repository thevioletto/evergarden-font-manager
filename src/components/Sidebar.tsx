import { useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "../../assets/logo.svg";
import logoDark from "../../assets/logo-dark.svg";
import { FONT_CATEGORIES } from "@/lib/font-categories";
import { ManagedIcon } from "@/components/ui/managed-icon";

interface SidebarProps {
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  onFilterSelect: (category: string | null, subcategory: string | null) => void;
  selectedView: string;
  onViewSelect: (view: string) => void;
  categoryCounts?: Record<string, number>;
  subcategoryCounts?: Record<string, Record<string, number>>;
}

export function Sidebar({
  selectedCategory,
  selectedSubcategory,
  onFilterSelect,
  selectedView,
  onViewSelect,
  categoryCounts = {},
  subcategoryCounts = {},
}: SidebarProps) {
  // Accordion: only one category open at a time
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleExpanded = (value: string) => {
    setExpandedCategory((prev) => (prev === value ? null : value));
  };

  return (
    <aside className="bg-background hidden h-full w-64 flex-col border-r md:flex">
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <div className="draggable-region mb-6 flex shrink-0 items-center select-none" data-tauri-drag-region>
          <img
            src={logo}
            alt="Evergarden"
            className="h-12 w-auto dark:hidden pointer-events-none"
          />
          <img
            src={logoDark}
            alt="Evergarden"
            className="hidden h-12 w-auto dark:block pointer-events-none"
          />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
          <div className="shrink-0">
            <p className="text-muted-foreground mb-4 text-[10px] font-semibold tracking-widest uppercase">
              Library
            </p>
            <ul className="space-y-1">
              <li>
                <Button
                  variant={
                    selectedView === "all" && selectedCategory === null
                      ? "secondary"
                      : "ghost"
                  }
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-9 w-full justify-start gap-3 px-3 font-medium"
                  onClick={() => {
                    setExpandedCategory(null);
                    onViewSelect("all");
                    onFilterSelect(null, null);
                  }}
                >
                  <ManagedIcon
                    name="Grid"
                    filled={selectedView === "all" && selectedCategory === null}
                    className="h-4 w-4"
                  />
                  All Typefaces
                </Button>
              </li>
              <li>
                <Button
                  variant={
                    selectedView === "recently-added" ? "secondary" : "ghost"
                  }
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-9 w-full justify-start gap-3 px-3 font-medium"
                  onClick={() => {
                    setExpandedCategory(null);
                    onViewSelect("recently-added");
                    onFilterSelect(null, null);
                  }}
                >
                  <ManagedIcon
                    name="Clock"
                    filled={selectedView === "recently-added"}
                    className="h-4 w-4"
                  />
                  Recently Added
                </Button>
              </li>
              <li>
                <Button
                  variant={selectedView === "favorites" ? "secondary" : "ghost"}
                  className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-9 w-full justify-start gap-3 px-3 font-medium"
                  onClick={() => {
                    setExpandedCategory(null);
                    onViewSelect("favorites");
                    onFilterSelect(null, null);
                  }}
                >
                  <ManagedIcon
                    name="Heart"
                    filled={selectedView === "favorites"}
                    className="h-4 w-4"
                  />
                  Favorites
                </Button>
              </li>
            </ul>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="text-muted-foreground mb-4 shrink-0 text-[10px] font-semibold tracking-widest uppercase">
              Categories
            </p>
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {FONT_CATEGORIES.map(({ value, label, icon, subcategories }) => {
                const isExpanded = expandedCategory === value;
                const isCategorySelected = selectedCategory === value;
                const catCount = categoryCounts[value] ?? 0;
                const subCounts = subcategoryCounts[value] ?? {};

                return (
                  <li key={value} className="space-y-2">
                    <button
                      type="button"
                      className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
                      onClick={() => {
                        toggleExpanded(value);
                        if (selectedCategory !== value) {
                          onViewSelect("all");
                          onFilterSelect(value, null);
                        }
                      }}
                    >
                      {isExpanded ? (
                        <ManagedIcon
                          name="ChevronDown"
                          className="h-4 w-4 shrink-0"
                        />
                      ) : (
                        <ManagedIcon
                          name="ChevronRight"
                          className="h-4 w-4 shrink-0"
                        />
                      )}
                      <ManagedIcon
                        name={icon}
                        filled={isCategorySelected}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {catCount > 0 && (
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {catCount}
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        <Button
                          size="sm"
                          variant={
                            isCategorySelected && selectedSubcategory === null
                              ? "secondary"
                              : "outline"
                          }
                          className="h-7 rounded-md px-2.5 text-xs font-normal"
                          onClick={() => onFilterSelect(value, null)}
                        >
                          All
                        </Button>
                        {subcategories.map((sub) => {
                          const count = subCounts[sub] ?? 0;
                          const isSelected =
                            isCategorySelected && selectedSubcategory === sub;
                          return (
                            <Button
                              key={sub}
                              size="sm"
                              variant={isSelected ? "secondary" : "outline"}
                              className="h-7 rounded-md px-2.5 text-xs font-normal"
                              onClick={() => onFilterSelect(value, sub)}
                            >
                              {sub}
                              {count > 0 && (
                                <span className="text-muted-foreground ml-1 tabular-nums">
                                  {count}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="shrink-0 border-t pt-4">
            <Button
              variant={selectedView === "pairing" ? "secondary" : "ghost"}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-9 w-full justify-start gap-3 px-3 font-medium"
              onClick={() => {
                setExpandedCategory(null);
                onViewSelect("pairing");
                onFilterSelect(null, null);
              }}
            >
              <ManagedIcon
                name="Link"
                filled={selectedView === "pairing"}
                className="h-4 w-4"
              />
              Font Pairing
            </Button>
          </div>
        </nav>
      </div>
    </aside>
  );
}
