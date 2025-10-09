"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

import { DraggableEditableTable } from "@/components/draggable";

import { ColumnConfig } from "./table-common";

// Generic type that works with any record shape (requires id field)
type TableRecord = Record<string, unknown> & { id: number | string };

// Column configuration - TypeScript will infer the shape from this
const columns = [
  {
    key: "customer",
    label: "Customer",
    type: "text",
    validate: (v: unknown) =>
      !v || !String(v).trim() ? "Customer is required" : null,
  },
  {
    key: "product",
    label: "Product",
    type: "text",
    validate: (v: unknown) =>
      !v || !String(v).trim() ? "Product is required" : null,
  },
  {
    key: "filtered",
    label: "Filtered",
    options: [
      { label: "True", value: "true" },
      { label: "False", value: "false" },
    ],
    type: "select",
  },
  {
    key: "position",
    label: "Position",
    type: "number",
  },
] satisfies ColumnConfig<TableRecord>[];

export default function Page() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <DraggableEditableTable<TableRecord>
        apiBaseUrl="http://localhost:8000/api/draggable"
        columns={columns}
        createNewRow={pos => ({
          customer: "",
          filtered: "false",
          id: `new-${Date.now()}`,
          position: pos,
          product: "",
        })}
        gcTime={5 * 60 * 1000} // Optional: 5 minutes cache garbage collection
        queryKey={["draggable-records"]} // Optional: custom query key
        staleTime={30_000} // Optional: 30 seconds before refetch
      />
    </QueryClientProvider>
  );
}
