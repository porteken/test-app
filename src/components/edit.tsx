"use client";
import { ReactNode } from "react";

import { EditableTable } from "./editable";

interface ColumnConfig<T, K extends keyof T = keyof T> {
  key: K;
  label: string;
  placeholder?: string;
  render?: (_value: T[K], _row: T) => ReactNode;
  type?: "checkbox" | "date" | "text";
  validate?: (_value: T[K], _row: T) => null | string;
}

interface EditableRecord {
  bought: boolean;
  customer: string;
  date: string;
  id: number | string;
}

const columns: ColumnConfig<EditableRecord>[] = [
  {
    key: "bought",
    label: "Bought",
    type: "checkbox",
  },
  {
    key: "customer",
    label: "Customer",
    placeholder: "Customer name",
    type: "text",
    validate: value =>
      (value as string)?.trim() ? null : "Customer name is required",
  },
  {
    key: "date",
    label: "Date",
    // ✅ OPTION 1: Remove render entirely (recommended)
    // Your CellRenderer already handles date formatting correctly
    type: "date",
    validate: value => (value ? null : "Date is required"),
  },
];

export default function Page() {
  return (
    <EditableTable<EditableRecord>
      apiBaseUrl="http://localhost:8000/api/editable"
      columns={columns}
    />
  );
}
