import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { faker } from "@faker-js/faker";
import { http, HttpResponse } from "msw";
import React from "react";

import { Autocomplete, AutocompleteItem } from "@/components/autocomplete";

// Mock data generator
const generateMockItems = (count: number, startId = 1): AutocompleteItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: startId + index,
    label: faker.person.fullName(),
  }));

// Pre-generate a large list of mock users
const mockUsers = generateMockItems(1000);

// Pre-generate mock countries
const mockCountries: AutocompleteItem[] = [
  { id: "us", label: "United States" },
  { id: "uk", label: "United Kingdom" },
  { id: "ca", label: "Canada" },
  { id: "au", label: "Australia" },
  { id: "de", label: "Germany" },
  { id: "fr", label: "France" },
  { id: "jp", label: "Japan" },
  { id: "cn", label: "China" },
  { id: "in", label: "India" },
  { id: "br", label: "Brazil" },
  { id: "mx", label: "Mexico" },
  { id: "es", label: "Spain" },
  { id: "it", label: "Italy" },
  { id: "nl", label: "Netherlands" },
  { id: "se", label: "Sweden" },
  { id: "no", label: "Norway" },
  { id: "dk", label: "Denmark" },
  { id: "fi", label: "Finland" },
  { id: "pl", label: "Poland" },
  { id: "pt", label: "Portugal" },
];

const meta: Meta<typeof Autocomplete> = {
  argTypes: {
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
  },
  component: Autocomplete,
  parameters: {
    docs: { autodocs: "tag" },
  },
  tags: ["autodocs"],
  title: "Components/Autocomplete",
};

export default meta;

type Story = StoryObj<typeof meta>;

// Client-side filtering story
export const ClientSideFiltering: Story = {
  args: {
    label: "Search Users",
    pageSize: 20,
    placeholder: "Type to search users...",
  },
  render: arguments_ => {
    const PAGE_SIZE = 20;

    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 300));

          const page = cursor ? Number(cursor) : 1;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
      />
    );
  },
};

// Server-side filtering with MSW
export const ServerSideFiltering: Story = {
  args: {
    label: "Search Countries",
    pageSize: 20,
    placeholder: "Type to search countries...",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/autocomplete/countries", ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get("search") || "";
          const cursor = url.searchParams.get("cursor") || "1";
          const page = Number.parseInt(cursor, 10);
          const pageSize = 20;

          const filtered = mockCountries.filter(country =>
            country.label.toLowerCase().includes(search.toLowerCase())
          );

          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const items = filtered.slice(start, end);

          return HttpResponse.json({
            cursor: items.length === pageSize ? page + 1 : undefined,
            items,
          });
        }),
      ],
    },
  },
  render: arguments_ => {
    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          const response = await fetch(
            `/api/autocomplete/countries?search=${encodeURIComponent(searchText)}&cursor=${cursor || "1"}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch countries");
          }

          return response.json();
        }}
      />
    );
  },
};

// With controlled selection
function WithControlledSelectionComponent(
  arguments_: React.ComponentProps<typeof Autocomplete>
) {
  const [selectedKey, setSelectedKey] = React.useState<
    null | number | string
  >();

  const selectedItem = mockUsers.find(user => user.id === selectedKey);
  const PAGE_SIZE = 20;

  return (
    <div className="flex flex-col gap-4">
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          await new Promise(resolve => setTimeout(resolve, 200));

          const page = cursor ? Number(cursor) : 1;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
        onSelectionChange={setSelectedKey}
        selectedKey={selectedKey}
      />
      {selectedItem && (
        <div className="rounded-md border border-border bg-muted p-4">
          <p className="text-sm font-medium">Selected:</p>
          <p className="text-sm text-muted-foreground">{selectedItem.label}</p>
        </div>
      )}
    </div>
  );
}

export const WithControlledSelection: Story = {
  args: {
    label: "Select a User",
    pageSize: 20,
    placeholder: "Type to search...",
  },
  render: arguments_ => <WithControlledSelectionComponent {...arguments_} />,
};

// With loading state
export const WithLoadingState: Story = {
  args: {
    label: "Slow Search",
    pageSize: 20,
    placeholder: "Type to search (slow response)...",
  },
  render: arguments_ => {
    const PAGE_SIZE = 20;

    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          // Simulate slow network
          await new Promise(resolve => setTimeout(resolve, 2000));

          const page = cursor ? Number(cursor) : 1;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
      />
    );
  },
};

// Error handling
export const WithError: Story = {
  args: {
    label: "Search with Error",
    onLoadItems: async () => {
      const response = await fetch("/api/autocomplete/error");

      if (!response.ok) {
        throw new Error("Failed to load items");
      }

      return response.json();
    },
    placeholder: "Type to trigger error...",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/autocomplete/error", () => {
          return new HttpResponse(
            JSON.stringify({ message: "Internal server error" }),
            {
              headers: { "Content-Type": "application/json" },
              status: 500,
            }
          );
        }),
      ],
    },
  },
};

// Empty state
export const EmptyState: Story = {
  args: {
    label: "No Results",
    onLoadItems: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { items: [] };
    },
    placeholder: "Type anything (no results)...",
  },
};

// Without label
export const WithoutLabel: Story = {
  args: {
    ariaLabel: "Search items",
    pageSize: 20,
    placeholder: "Search without label...",
  },
  render: arguments_ => {
    const PAGE_SIZE = 20;

    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          await new Promise(resolve => setTimeout(resolve, 300));

          const page = cursor ? Number(cursor) : 1;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
      />
    );
  },
};

// Infinite scroll with pagination
export const InfiniteScroll: Story = {
  args: {
    label: "Search Users (Infinite Scroll)",
    pageSize: 20,
    placeholder: "Type to search (scroll to load more)...",
  },
  render: arguments_ => {
    const PAGE_SIZE = 20;

    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 400));

          const page = cursor ? Number(cursor) : 1;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
      />
    );
  },
};

// Infinite scroll with server-side pagination
export const InfiniteScrollServerSide: Story = {
  args: {
    label: "Search Users (Server Paginated)",
    pageSize: 20,
    placeholder: "Type to search (server-side infinite scroll)...",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/autocomplete/users", ({ request }) => {
          const url = new URL(request.url);
          const search = url.searchParams.get("search") || "";
          const cursor = url.searchParams.get("cursor") || "1";
          const page = Number.parseInt(cursor, 10);
          const pageSize = 20;

          const filtered = mockUsers.filter(user =>
            user.label.toLowerCase().includes(search.toLowerCase())
          );

          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const items = filtered.slice(start, end);

          return HttpResponse.json({
            cursor: items.length === pageSize ? page + 1 : undefined,
            items,
          });
        }),
      ],
    },
  },
  render: arguments_ => {
    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          const response = await fetch(
            `/api/autocomplete/users?search=${encodeURIComponent(searchText)}&cursor=${cursor || "1"}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch users");
          }

          return response.json();
        }}
      />
    );
  },
};

// Large dataset with infinite scroll
export const LargeDataset: Story = {
  args: {
    label: "Search from 10,000 Users",
    pageSize: 20,
    placeholder: "Type to search large dataset...",
  },
  render: arguments_ => {
    // Generate a much larger dataset
    const largeDataset = generateMockItems(10_000);
    const PAGE_SIZE = 20;

    return (
      <Autocomplete
        {...arguments_}
        onLoadItems={async (searchText: string, cursor) => {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 300));

          const page = cursor ? Number(cursor) : 1;

          const filtered = largeDataset.filter(user =>
            user.label.toLowerCase().includes(searchText.toLowerCase())
          );

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          const items = filtered.slice(start, end);

          return {
            cursor: items.length === PAGE_SIZE ? page + 1 : undefined,
            items,
          };
        }}
      />
    );
  },
};
