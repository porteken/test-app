"use client";
import { DraggableEditableTable } from "@/components/draggable";

import { ColumnConfig } from "./table-common";

interface DraggableRecord {
  customer: string;
  filtered: "false" | "true";
  id: number | string;
  position: number;
  product: string;
}

const columns: ColumnConfig<DraggableRecord>[] = [
  {
    key: "customer",
    label: "Customer",
    type: "text",
    validate: v => (!v || !String(v).trim() ? "Customer is required" : null),
  },
  {
    key: "product",
    label: "Product",
    type: "text",
    validate: v => (!v || !String(v).trim() ? "Product is required" : null),
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
];

export default function Page() {
  return (
    <DraggableEditableTable<DraggableRecord>
      apiBaseUrl="http://localhost:8000/api/draggable"
      columns={columns}
      createNewRow={pos => ({
        customer: "",
        filtered: "false",
        id: `new-${Date.now()}`,
        position: pos,
        product: "",
      })}
    />
  );
}
