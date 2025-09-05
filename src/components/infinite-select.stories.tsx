// Corrected: Importing Meta and StoryObj from the framework package
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React, { useState } from "react";

// Import the component and its required types
import {
  type Entity,
  type InfiniteQueryPage,
  InfiniteSearchableSelect,
  type InfiniteSearchableSelectProperties,
} from "./infinite-select";

// Define a specific mock entity type for this story, extending the base Entity
type MockEntity = Entity;

// --- Storybook Meta Configuration ---
const meta: Meta<typeof InfiniteSearchableSelect<MockEntity>> = {
  argTypes: {
    // ...
  },
  component: InfiniteSearchableSelect,

  // Add the isolated decorator here
  decorators: [
    Story => {
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          {/* A container to give the popover some space */}
          <div style={{ minHeight: "350px" }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],

  tags: ["autodocs"],

  title: "Components/Infinite Select",
};

export default meta;

type Story = StoryObj<typeof meta>;

// --- Reusable Component for Story Logic ---
// This wrapper component encapsulates the React Query hooks and state management
// so that stories can focus on passing props (args).
const InfiniteSearchableSelectStoryComponent = (
  arguments_: Omit<
    InfiniteSearchableSelectProperties<MockEntity>,
    | "data"
    | "error"
    | "fetchNextPage"
    | "hasNextPage"
    | "isError"
    | "isFetching"
    | "isFetchingNextPage"
    | "itemToId"
    | "itemToName"
    | "onValueChange"
    | "search"
    | "selectedValue"
    | "setSearch"
  >
) => {
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState<MockEntity | null>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<InfiniteQueryPage<MockEntity>, Error>({
    getNextPageParam: lastPage => lastPage.nextPage,
    initialPageParam: 1,
    queryFn: async ({ pageParam: pageParameter = 1 }) => {
      const response = await fetch(
        `/api/entities?search=${search}&page=${pageParameter}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
    queryKey: ["entities", search],
  });

  return (
    <InfiniteSearchableSelect
      {...arguments_}
      data={data}
      error={error?.message}
      fetchNextPage={fetchNextPage}
      hasNextPage={!!hasNextPage}
      isError={isError}
      isFetching={isFetching}
      isFetchingNextPage={isFetchingNextPage}
      itemToId={(item: MockEntity) => item.id}
      itemToName={(item: MockEntity) => item.name}
      onValueChange={(value: MockEntity | null) => setSelectedValue(value)}
      search={search}
      selectedValue={selectedValue}
      setSearch={setSearch}
    />
  );
};

// --- Stories ---

export const Default: Story = {
  args: {
    config: {
      apiField: "entityId",
      key: "entity",
      label: "Select an Entity",
      placeholder: "Search for an entity...",
    },
    disabled: false,
  },
  render: arguments_ => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
  render: arguments_ => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};

export const WithError: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/entities", () => {
          return new HttpResponse(
            JSON.stringify({
              message: "Failed to fetch entities from server.",
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 500,
            }
          );
        }),
      ],
    },
  },
  render: arguments_ => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};
