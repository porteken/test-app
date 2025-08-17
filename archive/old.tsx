"use client";

import {
  Button,
  Combobox,
  Loader,
  TextInput,
  useCombobox,
} from "@mantine/core";
import { useDebouncedValue, useIntersection } from "@mantine/hooks";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

// This setup is necessary for the filters to function
const queryClient = new QueryClient();

// --- Mock Data and Fetch Functions (Required for Filters) ---

type Product = {
  id: string;
  name: string;
  userId: string;
};

type User = {
  id: string;
  name: string;
};

const MOCK_API_DATA_USERS: User[] = Array.from({ length: 100 }, (_, index) => ({
  id: `user-${index + 1}`,
  name: `User ${index + 1}`,
}));

const MOCK_API_DATA_PRODUCTS: Product[] = Array.from(
  { length: 1000 },
  (_, index) => ({
    id: `product-${index + 1}`,
    name: `Product ${index + 1}`,
    userId: `user-${Math.floor(index / 10) + 1}`,
  })
);

const fetchUsers = async ({ pageParam: pageParameter = 1, query = "" }) => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const itemsPerPage = 20;
  const filteredItems = MOCK_API_DATA_USERS.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  const start = (pageParameter - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = filteredItems.slice(start, end);

  return {
    items: paginatedItems,
    nextPage: end < filteredItems.length ? pageParameter + 1 : undefined,
  };
};

const fetchProducts = async ({
  filter = {} as { userId?: string },
  pageParam: pageParameter = 1,
  query = "",
}) => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const itemsPerPage = 20;
  let searchableItems = MOCK_API_DATA_PRODUCTS;

  if (filter.userId) {
    searchableItems = searchableItems.filter(
      product => product.userId === filter.userId
    );
  }

  if (query) {
    searchableItems = searchableItems.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  const start = (pageParameter - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedItems = searchableItems.slice(start, end);

  return {
    items: paginatedItems,
    nextPage: end < searchableItems.length ? pageParameter + 1 : undefined,
  };
};

// --- Reusable Component for Searchable Select (Filter Dropdown) ---

type InfiniteSearchableSelectProperties = {
  fetcher: (parameters: {
    filter?: Record<string, unknown>;
    pageParam?: number;
    query?: string;
  }) => Promise<{ items: { id: string; name: string }[]; nextPage?: number }>;
  filter?: Record<string, unknown>;
  label: string;
  onValueChange: (value: null | string) => void;
  placeholder: string;
  queryKey: string;
  selectedValue: null | string;
};

export default function App() {
  return (
    // QueryClientProvider is required for the InfiniteSearchableSelect hooks to work
    <QueryClientProvider client={queryClient}>
      <FilterControls />
    </QueryClientProvider>
  );
}

// --- Main Component ---

// This component now only contains the filters and their logic
function FilterControls() {
  const [selectedUserId, setSelectedUserId] = useState<null | string>(null);
  const [selectedProductId, setSelectedProductId] = useState<null | string>(
    null
  );

  const handleUserChange = (userId: null | string) => {
    setSelectedUserId(userId);
    // Reset product when user changes, as the available products depend on the user
    setSelectedProductId(null);
  };

  const handleProductChange = (productId: null | string) => {
    setSelectedProductId(productId);
    // If a product is selected, automatically select its associated user
    if (productId) {
      const product = MOCK_API_DATA_PRODUCTS.find(p => p.id === productId);
      if (product && product.userId !== selectedUserId) {
        setSelectedUserId(product.userId);
      }
    }
  };

  const handleClearFilters = () => {
    setSelectedUserId(null);
    setSelectedProductId(null);
  };

  return (
    <div
      style={{
        alignItems: "flex-end",
        display: "flex",
        gap: "1rem",
        padding: "2rem",
      }}
    >
      <InfiniteSearchableSelect
        fetcher={fetchUsers}
        label="Select a User"
        onValueChange={handleUserChange}
        placeholder="Search users..."
        queryKey="users"
        selectedValue={selectedUserId}
      />
      <InfiniteSearchableSelect
        fetcher={fetchProducts}
        // The product filter depends on the selected user
        filter={{ userId: selectedUserId }}
        label="Select a Product"
        onValueChange={handleProductChange}
        placeholder="Search products..."
        queryKey="products"
        selectedValue={selectedProductId}
      />
      <Button onClick={handleClearFilters} variant="default">
        Clear Filters
      </Button>
    </div>
  );
}

function InfiniteSearchableSelect({
  fetcher,
  filter,
  label,
  onValueChange,
  placeholder,
  queryKey,
  selectedValue,
}: InfiniteSearchableSelectProperties) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery({
      getNextPageParam: lastPage =>
        (lastPage as { nextPage?: number }).nextPage,
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        fetcher({ filter, pageParam, query: debouncedSearch }),
      queryKey: [queryKey, debouncedSearch, filter],
    });

  const allItems =
    data?.pages.flatMap(
      page => (page as { items: { id: string; name: string }[] }).items
    ) ?? [];

  useEffect(() => {
    if (selectedValue) {
      const item =
        queryKey === "users"
          ? MOCK_API_DATA_USERS.find(u => u.id === selectedValue)
          : MOCK_API_DATA_PRODUCTS.find(p => p.id === selectedValue);
      setSearch(item ? item.name : "");
    } else {
      setSearch("");
    }
  }, [selectedValue, queryKey]);

  const scrollContainerReference = useRef(null);
  const { entry, ref } = useIntersection({
    root: scrollContainerReference.current,
    threshold: 1,
  });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [entry, hasNextPage, isFetching, fetchNextPage]);

  const options = allItems.map(item => (
    <Combobox.Option key={item.id} value={item.id}>
      {item.name}
    </Combobox.Option>
  ));

  return (
    <div style={{ width: "300px" }}>
      <Combobox
        onOptionSubmit={value => {
          onValueChange(value);
          combobox.closeDropdown();
        }}
        store={combobox}
      >
        <Combobox.Target>
          <TextInput
            label={label}
            onBlur={() => {
              combobox.closeDropdown();
              if (selectedValue) {
                const item =
                  queryKey === "users"
                    ? MOCK_API_DATA_USERS.find(u => u.id === selectedValue)
                    : MOCK_API_DATA_PRODUCTS.find(p => p.id === selectedValue);
                setSearch(item ? item.name : "");
              } else {
                setSearch("");
              }
            }}
            onChange={event => {
              setSearch(event.currentTarget.value);
              combobox.openDropdown();
              if (event.currentTarget.value === "") {
                onValueChange(null);
              }
            }}
            onClick={() => combobox.openDropdown()}
            onFocus={() => combobox.openDropdown()}
            placeholder={placeholder}
            value={search}
          />
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Options>
            <div
              ref={scrollContainerReference}
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {options}
              {hasNextPage && <div ref={ref} style={{ height: 1 }} />}
              {isFetchingNextPage && (
                <Loader
                  size="sm"
                  style={{ display: "block", margin: "10px auto" }}
                />
              )}
            </div>
            {isFetching && !isFetchingNextPage && (
              <Combobox.Empty>
                <Loader size="sm" />
              </Combobox.Empty>
            )}
            {!isFetching && allItems.length === 0 && (
              <Combobox.Empty>Nothing found</Combobox.Empty>
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </div>
  );
}
