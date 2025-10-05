// stories/InfiniteSearchableSelect.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";

import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React, { useState } from "react";

// Import the KV-based component (path may differ)
import { InfiniteSearchableSelect } from "@/components/infinite-select";

type InfiniteQueryPageKV = { items: KVItem[]; nextPage?: number };
// Local types for the story
type KVItem = { key: number | string; value: string };

// --- Storybook Meta Configuration ---
const meta: Meta<typeof InfiniteSearchableSelect> = {
  argTypes: {},
  component: InfiniteSearchableSelect,
  decorators: [
    Story => {
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ minHeight: 350, padding: 16 }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    docs: { autodocs: "tag" },
  },
  tags: ["autodocs"],
  title: "Components/Infinite Select",
};
export default meta;

type Story = StoryObj<typeof meta>;

// --- Reusable Story Wrapper ---
const InfiniteSearchableSelectStoryComponent = (
  arguments_: Omit<
    ComponentProps<typeof InfiniteSearchableSelect>,
    "config" | "query"
  >
) => {
  const [search, setSearch] = useState("");

  const query = useInfiniteQuery<InfiniteQueryPageKV, Error>({
    getNextPageParam: lastPage => lastPage.nextPage,
    initialPageParam: 1,
    queryFn: async ({ pageParam: pageParameter = 1 }) => {
      const response = await fetch(
        `/api/entities?search=${encodeURIComponent(
          search
        )}&page=${pageParameter}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    },
    queryKey: ["entities-kv", search],
  });

  return (
    <InfiniteSearchableSelect
      {...arguments_}
      config={{
        apiField: "entityKey",
        key: "entity-kv",
        label: "Select an Entity",
        placeholder: "Search for an entity...",
      }}
      disabled={false}
      onSearchChange={setSearch}
      query={{
        data: query.data,
        error: query.error ?? null,
        // Wrap to satisfy a void-returning signature if your component expects void
        fetchNextPage: () => {
          void query.fetchNextPage();
        },
        hasNextPage: query.hasNextPage,
        isError: query.isError,
        isFetching: query.isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
      }}
      // Optional external search control (component also supports internal)
      search={search}
      // onChange={v => console.log("Selected:", v)}
    />
  );
};

// --- Stories ---

export const Default: Story = {
  args: { disabled: false },
  render: (arguments_: ComponentProps<typeof InfiniteSearchableSelect>) => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (arguments_: ComponentProps<typeof InfiniteSearchableSelect>) => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};

export const WithError: Story = {
  args: { disabled: false },
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
  render: (arguments_: ComponentProps<typeof InfiniteSearchableSelect>) => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};

export const WithManyItems: Story = {
  args: { disabled: false },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/entities", ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get("search") || "";
          const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
          const pageSize = 20;

          const all: KVItem[] = Array.from({ length: 300 }, (_, index) => ({
            key: `entity-${index + 1}`,
            value: `Mock Entity ${index + 1}`,
          }));

          const filtered = all.filter(item =>
            item.value.toLowerCase().includes(search.toLowerCase())
          );

          const start = (page - 1) * pageSize;
          const end = start + pageSize;

          const body: InfiniteQueryPageKV = {
            items: filtered.slice(start, end),
            nextPage: end < filtered.length ? page + 1 : undefined,
          };

          return HttpResponse.json(body);
        }),
      ],
    },
  },
  render: (arguments_: ComponentProps<typeof InfiniteSearchableSelect>) => (
    <InfiniteSearchableSelectStoryComponent {...arguments_} />
  ),
};
