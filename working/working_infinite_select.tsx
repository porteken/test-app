"use client";

import { Combobox, Loader, TextInput, useCombobox } from "@mantine/core";
import { useIntersection } from "@mantine/hooks";
import { InfiniteData } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

export type InfiniteQueryPage<TData> = {
  items: TData[];
  nextPage?: number;
};

export type InfiniteSearchableSelectProperties<TData> = {
  data: InfiniteData<InfiniteQueryPage<TData>> | undefined;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  itemToId: (item: TData) => string;
  itemToName: (item: TData) => string;
  label: string;
  onValueChange: (value: null | TData) => void;
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
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const allItems = useMemo(
    () => data?.pages.flatMap(page => page.items) ?? [],
    [data]
  );

  const scrollContainerReference = useRef<HTMLDivElement>(null);
  const { entry, ref: intersectionReference } = useIntersection({
    root: scrollContainerReference.current,
    threshold: 1,
  });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [entry, hasNextPage, isFetching, fetchNextPage]);

  const options = useMemo(
    () =>
      allItems.map(item => (
        <Combobox.Option key={itemToId(item)} value={itemToId(item)}>
          {itemToName(item)}
        </Combobox.Option>
      )),
    [allItems, itemToId, itemToName]
  );

  const renderOptions = () => {
    if (isError) {
      return (
        <Combobox.Empty style={{ color: "red" }}>
          Error fetching data
        </Combobox.Empty>
      );
    }

    if (options.length === 0 && !isFetching) {
      return <Combobox.Empty>Nothing found</Combobox.Empty>;
    }

    return (
      <>
        {options}
        {hasNextPage && (
          <div ref={intersectionReference} style={{ height: 1 }} />
        )}
        {isFetchingNextPage && (
          <Combobox.Empty>
            <Loader size="sm" />
          </Combobox.Empty>
        )}
      </>
    );
  };

  return (
    <Combobox
      onOptionSubmit={value => {
        const selectedItem =
          allItems.find(item => itemToId(item) === value) ?? null;
        onValueChange(selectedItem);
        setSearch(selectedItem ? itemToName(selectedItem) : "");
        combobox.closeDropdown();
      }}
      store={combobox}
      withinPortal={false}
    >
      <Combobox.Target>
        <TextInput
          label={label}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(selectedValue ? itemToName(selectedValue) : "");
          }}
          onChange={event => {
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
            if (event.currentTarget.value === "") {
              onValueChange(null);
            }
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={event => {
            combobox.openDropdown();
            event.currentTarget.select();
          }}
          placeholder={placeholder}
          rightSection={
            isFetching && !isFetchingNextPage ? <Loader size="xs" /> : undefined
          }
          value={search}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <div
            ref={scrollContainerReference}
            style={{ maxHeight: "200px", overflowY: "auto" }}
          >
            {renderOptions()}
          </div>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
