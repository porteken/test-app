"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { TablePagination } from "./table-pagination";

// ✅ 1. Ensure your data type includes a unique `id`
type ProductData = {
  id: string;
  product_name: string;
  store_name: string;
  user_name: string;
};

const productColumnHelper = createColumnHelper<ProductData>();

const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  defaultLimit: 10,
  endpoints: {
    data: "/api/data",
    delete: "/api/data", // ✅ 2. Specify the base path for the DELETE endpoint
    filters: "/api/filters",
  },
};

const filterConfigs = [
  {
    apiField: "user_name",
    key: "user",
    label: "User",
    placeholder: "Select User",
  },
  {
    apiField: "store_name",
    key: "store",
    label: "Store",
    placeholder: "Select Store",
  },
  {
    apiField: "product_name",
    key: "product",
    label: "Product",
    placeholder: "Select Product",
  },
];

const columnConfigs = [
  productColumnHelper.accessor("user_name", {
    cell: info => info.getValue(),
    header: "User Name",
  }),
  productColumnHelper.accessor("store_name", {
    cell: info => info.getValue(),
    header: "Store Name",
  }),
  productColumnHelper.accessor("product_name", {
    cell: info => info.getValue(),
    header: "Product Name",
  }),
];

export default function Home() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TablePagination
        apiConfig={apiConfig}
        columnConfigs={columnConfigs}
        enableDelete // ✅ 3. Simply add the prop to enable the delete action
        filterConfigs={filterConfigs}
        pageSize={20}
      />
    </QueryClientProvider>
  );
}
