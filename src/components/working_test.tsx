"use client";

import { createColumnHelper } from "@tanstack/react-table";

import { ReusableDataTable } from "./table";

type ProductData = {
  product_name: string;
  store_name: string;
  user_name: string;
};

const productColumnHelper = createColumnHelper<ProductData>();

export const ApiBasedProductTable = () => {
  const apiConfig = {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    defaultLimit: 20,
    endpoints: {
      data: "/api/data",
      filters: "/api/filters",
    },
  };

  const filterConfigs = [
    {
      apiField: "user_name",
      key: "user",
      label: "Select a User",
      placeholder: "Search for a user...",
    },
    {
      apiField: "store_name",
      key: "store",
      label: "Select a Store",
      placeholder: "Search for a store...",
    },
    {
      apiField: "product_name",
      key: "product",
      label: "Select a Product",
      placeholder: "Search for a product...",
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

  return (
    <ReusableDataTable<ProductData>
      apiConfig={apiConfig}
      columnConfigs={columnConfigs}
      filterConfigs={filterConfigs}
      pageSize={50}
      title="Data Results"
    />
  );
};

export default ApiBasedProductTable;
