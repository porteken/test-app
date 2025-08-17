"use client";

import { InfiniteData } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";

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

export type InfiniteQueryPage = {
  items: any[];
  nextPage?: number;
};

export type InfiniteSearchableSelectProperties<TData> = {
  data: InfiniteData<InfiniteQueryPage> | undefined;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  itemToId: (item: TData) => string;
  itemToName: (item: TData) => string;
  label: string;
  onValueChange: (value: null | TData) => void; // parent filter state updater
  placeholder: string;
  search: string;
  selectedValue: null | TData;
  setSearch: (search: string) => void;
};

export function InfiniteSearchableSelect<TData>({
  data,
  fetchNextPage,
  hasNextPage,
  isError,
  isFetching,
  isFetchingNextPage,
  itemToId,
  itemToName,
  label,
  onValueChange,
  placeholder,
  search,
  selectedValue,
  setSearch,
}: InfiniteSearchableSelectProperties<TData>) {
  const [open, setOpen] = useState(false);

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data]
  );

  // react-intersection-observer
  const { inView, ref: intersectionReference } = useInView({
    threshold: 1,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetching, fetchNextPage]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className="w-full justify-between"
            role="combobox"
            variant="outline"
          >
            {selectedValue ? itemToName(selectedValue) : placeholder}
            {isFetching && !isFetchingNextPage ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-70" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={value => {
                setSearch(value);
                if (value === "") {
                  onValueChange(null); // clear filter
                }
              }}
              placeholder={placeholder}
              value={search}
            />
            <CommandList className="max-h-52">
              {isError && (
                <CommandEmpty className="text-red-500">
                  Error fetching data
                </CommandEmpty>
              )}

              {!isError && allItems.length === 0 && !isFetching && (
                <CommandEmpty>Nothing found</CommandEmpty>
              )}

              <CommandGroup>
                {allItems.map(item => (
                  <CommandItem
                    key={itemToId(item)}
                    onSelect={() => {
                      onValueChange(item); // update parent filter state
                      setSearch(itemToName(item));
                      setOpen(false);
                    }}
                    value={itemToId(item)}
                  >
                    {itemToName(item)}
                  </CommandItem>
                ))}

                {hasNextPage && (
                  <div className="h-1" ref={intersectionReference} />
                )}

                {isFetchingNextPage && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
