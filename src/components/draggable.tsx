"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ActionButtons,
  CellRenderer,
  ColumnConfig,
  DeleteDialog,
  isPersistentId,
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "./table-common";

// -------------------- Props --------------------
interface DraggableEditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
  createNewRow: (_position: number) => T;
  gcTime?: number;
  queryKey?: string[];
  staleTime?: number;
}
type RowType = number | string | undefined
// -------------------- Component --------------------
export function DraggableEditableTable<T extends { id: number | string }>({
  apiBaseUrl,
  columns,
  createNewRow,
  gcTime = 5 * 60 * 1000,
  queryKey,
  staleTime = 30_000,
}: Readonly<DraggableEditableTableProperties<T>>) {
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<T[]>([]);
  const [editingRowId, setEditingRowId] = useState<RowType>();
  const [editedRow, setEditedRow] = useState<T | undefined>();
  const [rowToDelete, setRowToDelete] = useState<RowType>();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // -------------------- Data Fetching --------------------
  const defaultQueryKey = useMemo(
    () => ["draggable-table", apiBaseUrl],
    [apiBaseUrl]
  );

  const {
    data: fetchedData,
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery<T[], Error>({
    gcTime,
    queryFn: async () => {
      const response = await fetch(apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      return response.json();
    },
    queryKey: queryKey ?? defaultQueryKey,
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

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);
  const hasUnsavedChanges = editingRowId !== undefined;

  // -------------------- Mutations --------------------
  const reorderMutation = useMutation<T[], Error, T[]>({
    mutationFn: async (reorderedData: T[]) => {
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
      queryClient.invalidateQueries({ queryKey: queryKey ?? defaultQueryKey });
    },
  });

  const saveMutation = useMutation<
    T,
    Error,
    { data: T; isNew: boolean; tempId?: number | string }
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
    onSuccess: (savedRecord, variables) => {
      toast.success(`Record ${variables.isNew ? "created" : "updated"}`);

      // Remove temp row if it was a new record
      if (variables.isNew && variables.tempId) {
        setLocalData(current =>
          current.filter(row => row.id !== variables.tempId)
        );
      }

      queryClient.invalidateQueries({ queryKey: queryKey ?? defaultQueryKey });

      setEditingRowId(undefined);
      setEditedRow(undefined);
      setValidationErrors({});
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
      queryClient.invalidateQueries({ queryKey: queryKey ?? defaultQueryKey });
      setDeleteModalOpen(false);
      setRowToDelete(undefined);
    },
  });

  // -------------------- Drag sensors --------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  // -------------------- Handle drag end --------------------
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = data.findIndex(item => item.id === active.id);
      const newIndex = data.findIndex(item => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(data, oldIndex, newIndex);
      reorderMutation.mutate(reordered);
    },
    [data, reorderMutation]
  );

  // -------------------- Editing --------------------
  const startEditing = useCallback((row: T) => {
    setEditingRowId(row.id);
    setEditedRow({ ...row });
    setValidationErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    if (editedRow && !isPersistentId(editedRow.id)) {
      setLocalData(current => current.filter(r => r.id !== editedRow.id));
    }
    setEditingRowId(undefined);
    setEditedRow(undefined);
    setValidationErrors({});
  }, [editedRow]);

  const saveRow = useCallback(() => {
    if (!editedRow) {
      return;
    }

    // Validate
    const errors: Record<string, string> = {};
    for (const col of columns) {
      if (col.validate) {
        const error = col.validate(editedRow[col.key], editedRow);
        if (error) {
          errors[col.key as string] = error;
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const isNew = !isPersistentId(editedRow.id);
    saveMutation.mutate({
      data: editedRow,
      isNew,
      tempId: isNew ? editedRow.id : undefined,
    });
  }, [editedRow, columns, saveMutation]);

  // -------------------- Keyboard handlers --------------------
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingRowId === undefined) {
        return;
      }

      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveRow();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [editingRowId, saveRow, cancelEditing]);

  // -------------------- Delete --------------------
  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (rowToDelete !== undefined) {
      deleteMutation.mutate(rowToDelete);
    }
  }, [rowToDelete, deleteMutation]);

  // -------------------- Add --------------------
  const addRow = useCallback(() => {
    if (hasUnsavedChanges) {
      toast.warning("Please save or cancel your current changes first.");
      return;
    }
    const newRow = createNewRow(data.length);
    setLocalData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [createNewRow, data.length, startEditing, hasUnsavedChanges]);

  // -------------------- Update Edited Row --------------------
  const updateEditedRow = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setEditedRow(previous =>
        previous ? { ...previous, [key]: value } : undefined
      );
      setValidationErrors(previous => {
        const newErrors = { ...previous };
        delete newErrors[key as string];
        return newErrors;
      });
    },
    []
  );

  // -------------------- Render Logic --------------------
  const isSaving = saveMutation.isPending;

  const addRowButton = (
    <Button disabled={hasUnsavedChanges} onClick={addRow}>
      <Plus className="mr-2 h-4 w-4" />
      Add Row
    </Button>
  );

  if (isLoading) {
    return <TableLoadingState />;
  }

  if (isError && data.length === 0) {
    return <TableErrorState error={error} retry={refetch} />;
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">{addRowButton}</div>
        <TableEmptyState action={addRowButton} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        {addRowButton}
        {hasUnsavedChanges && (
          <p className="text-sm text-orange-600">
            Save or cancel to add a new row
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-32">Actions</TableHead>
                {columns.map(col => (
                  <TableHead key={String(col.key)}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {data.map(row => (
                  <SortableRow
                    cancelEditing={cancelEditing}
                    columns={columns}
                    editedRow={editedRow}
                    isEditing={editingRowId === row.id}
                    key={row.id}
                    openDeleteConfirmModal={openDeleteConfirmModal}
                    row={row}
                    saveRow={saveRow}
                    saving={isSaving}
                    startEditing={startEditing}
                    updateEditedRow={updateEditedRow}
                    validationErrors={validationErrors}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Delete Confirmation */}
      <DeleteDialog
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        open={deleteModalOpen}
      />
    </div>
  );
}

// -------------------- Sortable Row --------------------
function SortableRow<T extends { id: number | string }>(
  properties: Readonly<{
    cancelEditing: () => void;
    columns: ColumnConfig<T>[];
    editedRow: T | undefined;
    isEditing: boolean;
    openDeleteConfirmModal: (_id: number | string) => void;
    row: T;
    saveRow: () => void;
    saving: boolean;
    startEditing: (_row: T) => void;
    updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
    validationErrors: Record<string, string>;
  }>
) {
  const {
    cancelEditing,
    columns,
    editedRow,
    isEditing,
    openDeleteConfirmModal,
    row,
    saveRow,
    saving,
    startEditing,
    updateEditedRow,
    validationErrors,
  } = properties;

  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled: isEditing, id: row.id });

  const style = {
    opacity: isDragging ? 0.8 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  const isExistingRecord = isPersistentId(row.id);
  const safeRow = (isEditing ? editedRow : row) as T;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={isEditing ? "bg-yellow-50" : ""}
    >
      {/* Drag Handle */}
      <TableCell className="w-10">
        <button
          {...listeners}
          aria-label="Drag to reorder"
          className={`
            flex h-full w-full items-center justify-center
            ${isEditing ? "cursor-not-allowed opacity-50" : "cursor-grab"}
          `}
          disabled={isEditing}
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>

      {/* Actions */}
      <TableCell className="w-32">
        <ActionButtons
          isEditing={isEditing}
          isExistingRecord={isExistingRecord}
          onCancel={cancelEditing}
          onDelete={() => openDeleteConfirmModal(row.id)}
          onEdit={() => startEditing(row)}
          onSave={saveRow}
          saving={saving}
          validationErrors={validationErrors}
        />
      </TableCell>

      {/* Dynamic Columns */}
      {columns.map(col => {
        const value = safeRow[col.key];
        const errorMessage = validationErrors[col.key as string];
        return (
          <TableCell key={String(col.key)}>
            <CellRenderer
              col={col}
              errorMessage={errorMessage}
              isEditing={isEditing}
              saving={saving}
              updateEditedRow={updateEditedRow}
              value={value}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
