"use client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

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
    validate: (v: unknown) => {
      const stringValue = typeof v === "string" ? v : "";
      return stringValue.trim() ? null : "Customer is required";
    },
  },
  {
    key: "product",
    label: "Product",
    type: "text",
    validate: (v: unknown) => {
      const stringValue = typeof v === "string" ? v : "";
      return stringValue.trim() ? null : "Product is required";
    },
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
      <PageContent />
    </QueryClientProvider>
  );
}

function PageContent() {
  const apiBaseUrl = "http://localhost:8000/api/draggable";
  const queryClient = useQueryClient();

  // -------------------- Data Fetching --------------------
  const queryKey = ["draggable-records"];
  const gcTime = 5 * 60 * 1000;
  const staleTime = 30_000;

  const { data, error, isError, isLoading, refetch } = useQuery<
    TableRecord[],
    Error
  >({
    gcTime,
    queryFn: async () => {
      const response = await fetch(apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      return response.json();
    },
    queryKey,
    staleTime,
  });

  // -------------------- Mutations --------------------
  const reorderMutation = useMutation<TableRecord[], Error, TableRecord[]>({
    mutationFn: async (reorderedData: TableRecord[]) => {
      const updatePromises = reorderedData.map(async (row, index) => {
        const response = await fetch(`${apiBaseUrl}/${row.id}`, {
          body: JSON.stringify({ ...row, position: index }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (!response.ok) {
          throw new Error(`Failed to update position for row ${row.id}`);
        }
        return response.json();
      });

      return Promise.all(updatePromises);
    },
    onError: (error: Error) => {
      toast.error("Error updating order", { description: error.message });
    },
    onSuccess: () => {
      toast.success("Row order updated");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveMutation = useMutation<
    TableRecord,
    Error,
    { data: TableRecord; isNew: boolean; tempId?: number | string }
  >({
    mutationFn: async ({ data: rowData, isNew }) => {
      const url = isNew ? apiBaseUrl : `${apiBaseUrl}/${rowData.id}`;
      const method = isNew ? "POST" : "PUT";
      const payload = isNew ? { ...rowData } : rowData;

      if (isNew) {
        delete (payload as { id?: number | string }).id;
      }

      const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          errorBody.message || `Failed to save: ${response.statusText}`
        );
      }

      return response.json();
    },
    onError: (error: Error) => {
      toast.error("Error saving record", { description: error.message });
    },
    onSuccess: (_savedRecord, variables) => {
      toast.success(`Record ${variables.isNew ? "created" : "updated"}`);

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number | string>({
    mutationFn: async (id: number | string) => {
      const response = await fetch(`${apiBaseUrl}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }
    },
    onError: (error: Error) => {
      toast.error("Error deleting record", { description: error.message });
    },
    onSuccess: () => {
      toast.success("Record deleted");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // -------------------- Callbacks --------------------
  const onReorder = useCallback(
    (reorderedData: TableRecord[]) => {
      reorderMutation.mutate(reorderedData);
    },
    [reorderMutation]
  );

  const onSave = useCallback(
    (editedRow: TableRecord, isNew: boolean, temporaryId?: number | string) => {
      saveMutation.mutate({
        data: editedRow,
        isNew,
        tempId: temporaryId,
      });
    },
    [saveMutation]
  );

  const onDelete = useCallback(
    (id: number | string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const createNewRow = useCallback((position: number): TableRecord => {
    return {
      customer: "",
      filtered: "false",
      id: `new-${Date.now()}`,
      position,
      product: "",
    };
  }, []);

  return (
    <DraggableEditableTable<TableRecord>
      columns={columns}
      createNewRow={createNewRow}
      data={data ?? []}
      error={error}
      isError={isError}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      onDelete={onDelete}
      onReorder={onReorder}
      onSave={onSave}
      refetch={refetch}
    />
  );
}
