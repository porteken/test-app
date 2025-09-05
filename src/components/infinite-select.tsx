import { ChevronsUpDown, Loader2, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInView } from "react-intersection-observer";
import { useDebouncedCallback } from "use-debounce";
export type Entity = {
  id: string;
  name: string;
};
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export type FilterConfig = {
  apiField: string;
  key: string;
  label: string;
  placeholder: string;
};
export type InfiniteQueryPage<TItem extends Entity = Entity> = {
  items: TItem[];
  nextPage?: number;
};

export type InfiniteSearchableSelectProperties<TData extends Entity> = {
  config: FilterConfig;
  data: InfiniteData<InfiniteQueryPage<TData>> | undefined;
  disabled?: boolean;
  error?: string;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  itemToId: (_item: TData) => string;
  itemToName: (_item: TData) => string;
  onValueChange: (_value: null | TData) => void;
  search: string;
  selectedValue: null | TData;
  setSearch: (_search: string) => void;
};
import { InfiniteData } from "@tanstack/react-query";

export function InfiniteSearchableSelect<TData extends Entity>({
  config,
  data,
  disabled = false,
  error,
  fetchNextPage,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  itemToId,
  itemToName,
  onValueChange,
  search,
  selectedValue,
  setSearch,
}: Readonly<InfiniteSearchableSelectProperties<TData>>) {
  const [open, setOpen] = useState(false);
  const commandListReference = useRef<HTMLDivElement>(null);

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data]
  );

  const { inView, ref: intersectionReference } = useInView({
    rootMargin: "100px",
    threshold: 0.1,
  });

  // Debounce the infinite loading to prevent excessive API calls
  const debouncedFetchNext = useDebouncedCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, 300);

  useEffect(() => {
    if (inView) {
      debouncedFetchNext();
    }
  }, [inView, debouncedFetchNext]);

  const handleSelect = useCallback(
    (item: TData) => {
      onValueChange(item);
      setSearch(itemToName(item));
      setOpen(false);
    },
    [onValueChange, setSearch, itemToName]
  );

  const handleClear = useCallback(
    (event_: React.KeyboardEvent | React.MouseEvent) => {
      if ("key" in event_ && event_.key !== "Enter" && event_.key !== " ") {
        return;
      }
      event_.preventDefault();
      event_.stopPropagation();
      onValueChange(null);
      setSearch("");
    },
    [onValueChange, setSearch]
  );

  const handleKeyDown = useCallback((event_: React.KeyboardEvent) => {
    if (event_.key === "Escape") {
      setOpen(false);
    }
  }, []);

  // Reset scroll position when search changes
  useEffect(() => {
    if (commandListReference.current) {
      commandListReference.current.scrollTop = 0;
    }
  }, [search]);

  const hasValidItems = allItems.length > 0;
  const showError = isError || !!error;
  const showEmpty =
    !showError && !hasValidItems && !isFetching && search.length > 0;
  const comboboxId = React.useMemo(
    () => `combobox-${config.key}`,
    [config.key]
  );

  return (
    <div className="flex flex-col gap-2">
      <label className={`text-sm font-medium`} htmlFor={comboboxId}>
        {config.label}
      </label>

      <Popover onOpenChange={setOpen} open={open}>
        <div className="relative">
          <PopoverTrigger asChild>
            <Button
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-invalid={showError}
              className={`
                w-full justify-between
                ${
                  showError
                    ? `
                      border-red-500
                      focus:border-red-500
                    `
                    : ""
                }
              `}
              disabled={disabled}
              id={comboboxId}
              onKeyDown={handleKeyDown}
              variant="outline"
            >
              <span className="truncate">
                {selectedValue ? itemToName(selectedValue) : config.placeholder}
              </span>

              {isFetching && !isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin opacity-70" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>

          {selectedValue && !disabled && (
            <button
              aria-label={`Clear filter for ${config.label}`}
              className={`
                absolute top-1/2 right-6 flex h-5 w-5 -translate-y-1/2
                cursor-pointer items-center justify-center rounded p-0
                hover:bg-gray-100
              `}
              onClick={handleClear}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              aria-label="Search options"
              onValueChange={value => {
                setSearch(value);
              }}
              placeholder={config.placeholder}
              value={search}
            />

            <CommandList className="max-h-52" ref={commandListReference}>
              {showError && (
                <CommandEmpty className="text-red-500">
                  {error || "Error fetching data"}
                </CommandEmpty>
              )}

              {showEmpty && <CommandEmpty>No results found</CommandEmpty>}

              {hasValidItems && (
                <CommandGroup>
                  {allItems.map(item => (
                    <CommandItem
                      className="cursor-pointer"
                      key={itemToId(item)}
                      onSelect={() => handleSelect(item)}
                      value={itemToId(item)}
                    >
                      <span className="truncate">{itemToName(item)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {hasNextPage && (
                <div
                  className="h-4"
                  data-testid="infinite-scroll-trigger"
                  ref={intersectionReference}
                />
              )}

              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showError && error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
