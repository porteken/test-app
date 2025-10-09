"use client";

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EditableTable } from "./editable";
import { ColumnConfig, isPersistentId } from "./table-common";

// Generic type that works with any record shape (requires id field)
type TableRecord = Record<string, unknown> & { id: number | string };

// Column configuration - TypeScript will infer the shape from this
const columns = [
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
    validate: (v: unknown) => {
      const stringValue = typeof v === "string" ? v : "";
      return stringValue.trim() ? null : "Customer name is required";
    },
  },
  {
    key: "date",
    label: "Date",
    type: "date",
    validate: (v: unknown) => (v ? null : "Date is required"),
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
  const apiBaseUrl = "http://localhost:8000/api/editable";
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<TableRecord[]>([]);

  // -------------------- Data Fetching --------------------
  const defaultQueryKey = useMemo(
    () => ["editable-table", apiBaseUrl],
    [apiBaseUrl]
  );

  const queryKey = defaultQueryKey;
  const gcTime = 5 * 60 * 1000;
  const staleTime = 30_000;

  const {
    data: fetchedData,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery<TableRecord[], Error>({
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

  // Sync fetched data to local data for optimistic updates
  const data = useMemo(() => {
    if (fetchedData) {
      // Preserve any new unsaved rows
      const newRows = localData.filter(row => !isPersistentId(row.id));
      return [...newRows, ...fetchedData];
    }
    return localData;
  }, [fetchedData, localData]);

  // -------------------- Mutations --------------------
  const saveMutation = useMutation<
    TableRecord,
    Error,
    { data: TableRecord; isNew: boolean; tempId?: number | string }
  >({
    mutationFn: async ({ data: rowData, isNew }) => {
      const url = isNew ? apiBaseUrl : `${apiBaseUrl}/${rowData.id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        body: JSON.stringify(rowData),
        headers: { "Content-Type": "application/json" },
        method,
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }

      return response.json();
    },
    onError: (error: Error) => {
      toast.error("Error saving record", { description: error.message });
    },
    onSuccess: (savedRecord, variables) => {
      toast.success(
        `Record ${variables.isNew ? "created" : "updated"} successfully`
      );

      // Remove temp row if it was a new record
      if (variables.isNew && variables.tempId) {
        setLocalData(current =>
          current.filter(row => row.id !== variables.tempId)
        );
      }

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
      toast.success("Record deleted successfully");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // -------------------- Callbacks --------------------
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

  return (
    <EditableTable<TableRecord>
      columns={columns}
      data={data}
      error={error}
      isError={isError}
      isLoading={isLoading}
      isSaving={saveMutation.isPending}
      onDelete={onDelete}
      onSave={onSave}
      refetch={refetch}
      setLocalData={setLocalData}
    />
  );
}
