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
}
type RowType = number | string | undefined
// -------------------- Component --------------------
export function DraggableEditableTable<T extends { id: number | string }>({
  apiBaseUrl,
  columns,
  createNewRow,
}: Readonly<DraggableEditableTableProperties<T>>) {
  const [data, setData] = useState<T[]>([]);
  const [editingRowId, setEditingRowId] = useState<RowType>();
  const [editedRow, setEditedRow] = useState<T | undefined>();
  const [rowToDelete, setRowToDelete] = useState<RowType>();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<RowType>();
  const [error, setError] = useState<Error | undefined>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);
  const hasUnsavedChanges = editingRowId !== undefined;

  // -------------------- Fetch --------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const response = await fetch(apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const result: T[] = await response.json();
      setData(result);
    } catch (error_) {
      const error__ =
        error_ instanceof Error ? error_ : new Error("Failed to fetch data");
      setError(error__);
      toast.error("Error fetching data", { description: error__.message });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------- Drag sensors --------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  // -------------------- Handle drag end --------------------
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = data.findIndex(item => item.id === active.id);
      const newIndex = data.findIndex(item => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const originalData = [...data];
      const reordered = arrayMove(data, oldIndex, newIndex);
      setData(reordered);

      try {
        const updatePromises = reordered.map(async (row, index) => {
          const response = await fetch(`${apiBaseUrl}/${row.id}`, {
            body: JSON.stringify({ ...row, position: index }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          });
          if (!response.ok) {
            throw new Error(`Failed to update position for row ${row.id}`);
          }
          const result: T = await response.json();
          return result;
        });

        await Promise.all(updatePromises);
        toast.success("Row order updated");
      } catch (error_) {
        const errorMessage =
          error_ instanceof Error ? error_.message : "Failed to update order";
        toast.error("Error updating order", { description: errorMessage });
        // Revert to original order on failure
        setData(originalData);
      }
    },
    [data, apiBaseUrl]
  );

  // -------------------- Editing --------------------
  const startEditing = useCallback((row: T) => {
    setEditingRowId(row.id);
    setEditedRow({ ...row });
    setValidationErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    if (editedRow && !isPersistentId(editedRow.id)) {
      setData(current => current.filter(r => r.id !== editedRow.id));
    }
    setEditingRowId(undefined);
    setEditedRow(undefined);
    setValidationErrors({});
  }, [editedRow]);

  // -------------------- API Service --------------------
  const apiService = useMemo(
    () => ({
      performSave: async (url: string, method: string, payload: Partial<T>): Promise<T> => {
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
        const result: T = await response.json();
        return result;
      },
      prepareRequest: (row: T, baseUrl: string) => {
        const isNew = !isPersistentId(row.id);
        const url = isNew ? baseUrl : `${baseUrl}/${row.id}`;
        const method = isNew ? "POST" : "PUT";
        const payload = { ...row };
        if (isNew) {
          delete (payload as { id?: number | string }).id;
        }
        return { isNew, method, payload, url };
      },
      validateRow: (row: T, cols: ColumnConfig<T>[]) => {
        const errors: Record<string, string> = {};
        for (const col of cols) {
          if (col.validate) {
            const error = col.validate(row[col.key], row);
            if (error) {
              errors[col.key as string] = error;
            }
          }
        }
        return errors;
      },
    }),
    []
  );

  const saveRow = useCallback(async () => {
    if (!editedRow) {
      return;
    }

    const errors = apiService.validateRow(editedRow, columns);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const { isNew, method, payload, url } = apiService.prepareRequest(
      editedRow,
      apiBaseUrl
    );

    try {
      setSaving(true);
      const saved = await apiService.performSave(url, method, payload);
      setData(current => current.map(r => (r.id === editedRow.id ? saved : r)));
      toast.success(`Record ${isNew ? "created" : "updated"}`);
      setEditingRowId(undefined);
      setEditedRow(undefined);
      setValidationErrors({});
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to save record";
      toast.error("Error saving record", { description: errorMessage });
    } finally {
      setSaving(false);
    }
  }, [editedRow, apiBaseUrl, columns, apiService]);

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

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === undefined) {
      return;
    }

    const deletedRow = data.find(r => r.id === rowToDelete);
    if (!deletedRow) {
      return;
    }

    // Optimistic update
    setData(current => current.filter(r => r.id !== rowToDelete));
    setDeleteModalOpen(false);
    setDeleting(rowToDelete);
    setRowToDelete(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/${rowToDelete}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }
      toast.success("Record deleted");
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
      toast.error("Error deleting record", { description: errorMessage });
      // Rollback on failure
      setData(current => {
        const index = current.findIndex(r => r.id > deletedRow.id);
        if (index === -1) {
          return [...current, deletedRow];
        }
        return [...current.slice(0, index), deletedRow, ...current.slice(index)];
      });
    } finally {
      setDeleting(undefined);
    }
  }, [rowToDelete, apiBaseUrl, data]);

  // -------------------- Add --------------------
  const addRow = useCallback(() => {
    if (hasUnsavedChanges) {
      toast.warning("Please save or cancel your current changes first.");
      return;
    }
    const newRow = createNewRow(data.length);
    setData(previous => [newRow, ...previous]);
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
  const addRowButton = (
    <Button disabled={hasUnsavedChanges} onClick={addRow}>
      <Plus className="mr-2 h-4 w-4" />
      Add Row
    </Button>
  );

  if (loading) {
    return <TableLoadingState />;
  }

  if (error && data.length === 0) {
    return <TableErrorState error={error} retry={fetchData} />;
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
                    deleting={deleting === row.id}
                    editedRow={editedRow}
                    isEditing={editingRowId === row.id}
                    key={row.id}
                    openDeleteConfirmModal={openDeleteConfirmModal}
                    row={row}
                    saveRow={saveRow}
                    saving={saving}
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
    deleting: boolean;
    editedRow: T | undefined;
    isEditing: boolean;
    openDeleteConfirmModal: (_id: number | string) => void;
    row: T;
    saveRow: () => Promise<void>;
    saving: boolean;
    startEditing: (_row: T) => void;
    updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
    validationErrors: Record<string, string>;
  }>
) {
  const {
    cancelEditing,
    columns,
    deleting,
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
      className={`
        ${isEditing ? "bg-yellow-50" : ""}
        ${deleting ? "opacity-50" : ""}
      `}
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
