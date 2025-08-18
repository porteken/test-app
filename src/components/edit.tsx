"use client";
import { EditableTable } from "./editable";

interface ColumnConfig<T> {
  key: keyof T;
  label: string;
  placeholder?: string;
  render?: (value: any, row: T) => React.ReactNode;
  type?: "checkbox" | "date" | "text";
  validate?: (value: any, row: T) => null | string;
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
    validate: value => (value?.trim() ? null : "Customer name is required"),
  },
  {
    key: "date",
    label: "Date",
    render: value => (value ? new Date(value).toLocaleDateString() : "No date"),
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
