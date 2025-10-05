"use client";

import { IconLoader2, IconX } from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";
import { useInView } from "react-intersection-observer";
import { useAsyncList } from "react-stately";

import { cn } from "@/lib/utils";

export interface AutocompleteItem {
  id: number | string;
  label: string;
}

export interface AutocompleteProperties {
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** CSS class name for the wrapper */
  className?: string;
  /** Label text to display above the input */
  label?: string;
  /** Load initial items on focus (default: true) */
  loadOnFocus?: boolean;
  /** Async function to fetch filtered items based on input value and cursor */
  onLoadItems: (
    _searchText: string,
    _cursor?: number | string
  ) => Promise<{ cursor?: number | string; items: AutocompleteItem[] }>;
  /** Event handler when an item is selected */
  onSelectionChange?: (_key?: null | number | string) => void;
  /** Page size for loading items (default: 20) */
  pageSize?: number;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Currently selected key */
  selectedKey?: null | number | string;
}

export function Autocomplete({
  ariaLabel,
  className,
  label,
  loadOnFocus = true,
  onLoadItems,
  onSelectionChange,
  placeholder = "Search...",
  selectedKey,
}: Readonly<AutocompleteProperties>) {
  const [filterText, setFilterText] = useState("");

  const list = useAsyncList<AutocompleteItem>({
    async load({ cursor, filterText: currentFilter }) {
      try {
        const result = await onLoadItems(currentFilter || "", cursor);
        return {
          cursor: result.cursor ? String(result.cursor) : undefined,
          items: result.items,
        };
      } catch (error) {
        console.error("Error loading items:", error);
        return {
          items: [],
        };
      }
    },
  });

  // Intersection observer for infinite scroll
  const { ref: inViewReference } = useInView({
    onChange: inView => {
      if (
        inView &&
        list.loadingState !== "loading" &&
        list.loadingState !== "loadingMore" &&
        list.items.length > 0
      ) {
        list.loadMore();
      }
    },
    threshold: 0,
  });

  // Load initial items on mount if loadOnFocus is true
  useEffect(() => {
    if (loadOnFocus && list.items.length === 0) {
      list.reload();
    }
  }, [loadOnFocus]);

  const handleInputChange = (value: string) => {
    setFilterText(value);
    list.setFilterText(value);
  };

  const handleClear = () => {
    setFilterText("");
    list.setFilterText("");
    onSelectionChange?.();
  };

  const handleFocus = () => {
    if (loadOnFocus && list.items.length === 0) {
      list.reload();
    }
  };

  return (
    <ComboBox
      allowsEmptyCollection
      aria-label={ariaLabel ?? label}
      className={cn("group flex w-full flex-col gap-2", className)}
      inputValue={filterText}
      items={list.items}
      menuTrigger="focus"
      onInputChange={handleInputChange}
      onSelectionChange={onSelectionChange}
      selectedKey={selectedKey}
    >
      {label && (
        <Label className="text-sm font-medium text-foreground">{label}</Label>
      )}
      <div className="relative flex items-center">
        <Input
          className={`
            flex h-10 w-full rounded-md border border-input bg-background px-3
            py-2 pr-20 text-sm ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:outline-none
            disabled:cursor-not-allowed disabled:opacity-50
          `}
          onFocus={handleFocus}
          placeholder={placeholder}
        />
        <div
          className={`
            pointer-events-none absolute right-1 flex items-center gap-1
          `}
        >
          {filterText && (
            <Button
              className={`
                pointer-events-auto flex h-7 w-7 items-center justify-center
                rounded-sm opacity-70 transition-opacity
                hover:opacity-100
                focus:ring-2 focus:ring-ring focus:ring-offset-2
                focus:outline-none
              `}
              excludeFromTabOrder
              onPress={handleClear}
            >
              <IconX className="h-4 w-4" />
            </Button>
          )}
          {list.isLoading && (
            <div className="flex h-7 w-7 items-center justify-center">
              <IconLoader2
                className={`h-4 w-4 animate-spin text-muted-foreground`}
              />
            </div>
          )}
          <span
            className={`
              flex h-7 w-7 items-center justify-center text-muted-foreground
            `}
          >
            ▼
          </span>
        </div>
      </div>
      <Popover
        className={`
          w-[--trigger-width] rounded-md border border-border bg-popover
          text-popover-foreground shadow-md
          data-[entering]:animate-in data-[entering]:fade-in-0
          data-[entering]:zoom-in-95
          data-[exiting]:animate-out data-[exiting]:fade-out-0
          data-[exiting]:zoom-out-95
        `}
      >
        <div className="max-h-[300px] overflow-auto">
          <ListBox
            className="p-1"
            renderEmptyState={() => {
              if (list.isLoading) {
                return (
                  <div
                    className={`
                      px-3 py-6 text-center text-sm text-muted-foreground
                    `}
                  >
                    Loading...
                  </div>
                );
              }

              if (filterText.trim()) {
                return (
                  <div
                    className={`
                      px-3 py-6 text-center text-sm text-muted-foreground
                    `}
                  >
                    No results found.
                  </div>
                );
              }

              if (loadOnFocus) {
                return (
                  <div
                    className={`
                      px-3 py-6 text-center text-sm text-muted-foreground
                    `}
                  >
                    No items available.
                  </div>
                );
              }

              return (
                <div
                  className={`
                    px-3 py-6 text-center text-sm text-muted-foreground
                  `}
                >
                  Start typing to search...
                </div>
              );
            }}
          >
            {(item: AutocompleteItem) => (
              <ListBoxItem
                className={`
                  relative flex cursor-default items-center rounded-sm px-3 py-2
                  text-sm outline-none select-none
                  data-[disabled]:pointer-events-none data-[disabled]:opacity-50
                  data-[focused]:bg-accent data-[focused]:text-accent-foreground
                `}
                id={item.id}
                textValue={item.label}
              >
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
          {list.items.length > 0 && (
            <div className="flex justify-center p-2" ref={inViewReference}>
              {list.loadingState === "loadingMore" && (
                <div
                  className={`
                    flex items-center gap-2 text-sm text-muted-foreground
                  `}
                >
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Popover>
    </ComboBox>
  );
}
