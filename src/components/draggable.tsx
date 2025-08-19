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
import { AlertCircle, GripVertical, Loader2, Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "./table-common";

// -------------------- Props --------------------
interface DraggableEditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
  createNewRow: (_position: number) => T;
}

// -------------------- Component --------------------
export function DraggableEditableTable<T extends { id: number | string }>({
  apiBaseUrl,
  columns,
  createNewRow,
}: DraggableEditableTableProperties<T>) {
  const [data, setData] = useState<T[]>([]);
  const [editingRowId, setEditingRowId] = useState<null | number | string>(
    null
  );
  const [editedRow, setEditedRow] = useState<null | T>(null);
  const [rowToDelete, setRowToDelete] = useState<null | number | string>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);
  const hasUnsavedChanges = editingRowId !== null;

  // -------------------- Fetch --------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to fetch data";
      setError(errorMessage);
      toast.error("Error fetching data", { description: errorMessage });
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

      const reordered = arrayMove(data, oldIndex, newIndex);
      setData(reordered);

      try {
        await Promise.all(
          reordered.map((row, index) =>
            fetch(`${apiBaseUrl}/${row.id}`, {
              body: JSON.stringify({ ...row, position: index }),
              headers: { "Content-Type": "application/json" },
              method: "PUT",
            })
          )
        );
        toast.success("Row order updated");
      } catch (error_) {
        const errorMessage =
          error_ instanceof Error ? error_.message : "Failed to update order";
        toast.error("Error updating order", { description: errorMessage });
        fetchData();
      }
    },
    [data, apiBaseUrl, fetchData]
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
    setEditingRowId(null);
    setEditedRow(null);
    setValidationErrors({});
  }, [editedRow]);

  const saveRow = useCallback(async () => {
    if (!editedRow) {
      return;
    }

    // Run validations
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
    const url = isNew ? apiBaseUrl : `${apiBaseUrl}/${editedRow.id}`;
    const method = isNew ? "POST" : "PUT";

    try {
      setSaving(true);
      const response = await fetch(url, {
        body: JSON.stringify(editedRow),
        headers: { "Content-Type": "application/json" },
        method,
      });
      if (!response.ok) {
        throw new Error(`Failed to save: ${response.statusText}`);
      }
      const saved = await response.json();

      setData(current =>
        isNew
          ? [saved, ...current.filter(r => r.id !== editedRow.id)]
          : current.map(r => (r.id === editedRow.id ? saved : r))
      );

      toast.success(`Record ${isNew ? "created" : "updated"}`);
      setEditingRowId(null);
      setEditedRow(null);
      setValidationErrors({});
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to save record";
      toast.error("Error saving record", { description: errorMessage });
    } finally {
      setSaving(false);
    }
  }, [editedRow, apiBaseUrl, columns]);

  // -------------------- Delete --------------------
  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === null) {
      return;
    }

    try {
      await fetch(`${apiBaseUrl}/${rowToDelete}`, { method: "DELETE" });
      setData(current => current.filter(r => r.id !== rowToDelete));
      toast.success("Record deleted");
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
      toast.error("Error deleting record", { description: errorMessage });
    } finally {
      setDeleteModalOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete, apiBaseUrl]);

  // -------------------- Add --------------------
  const addRow = useCallback(() => {
    const newRow = createNewRow(data.length);
    setData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [createNewRow, data.length, startEditing]);

  // -------------------- Update Edited Row --------------------
  const updateEditedRow = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setEditedRow(previous =>
        previous ? { ...previous, [key]: value } : null
      );
      setValidationErrors(previous => {
        const newErrors = { ...previous };
        delete newErrors[key as string];
        return newErrors;
      });
    },
    []
  );

  // -------------------- Render --------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading...</p>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <Alert className="max-w-2xl" variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium">Error loading data</p>
          <p>{error}</p>
          <Button onClick={fetchData} size="sm" variant="outline">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Row */}
      <div className="flex items-center justify-between">
        <Button disabled={hasUnsavedChanges} onClick={addRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add Row
        </Button>
        {hasUnsavedChanges && (
          <p className="text-sm text-orange-600">
            Finish editing before adding a new row
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
function SortableRow<T extends { id: number | string }>(properties: {
  cancelEditing: () => void;
  columns: ColumnConfig<T>[];
  editedRow: null | T;
  isEditing: boolean;
  openDeleteConfirmModal: (_id: number | string) => void;
  row: T;
  saveRow: () => Promise<void>;
  saving: boolean;
  startEditing: (_row: T) => void;
  updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
  validationErrors: Record<string, string>;
}) {
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
        <div
          {...listeners}
          className={`
            flex items-center justify-center
            ${isEditing ? "cursor-not-allowed opacity-50" : "cursor-grab"}
          `}
        >
          <GripVertical className="h-4 w-4" />
        </div>
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
              row={row}
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
