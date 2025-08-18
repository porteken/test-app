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
import {
  AlertCircle,
  Edit,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// -------------------- Types --------------------
export interface ColumnConfig<T> {
  key: keyof T;
  label: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  type?: "checkbox" | "date" | "select" | "text";
  validate?: (value: T[keyof T], row: T) => null | string;
}

interface DraggableEditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
  createNewRow: (position: number) => T;
}

// -------------------- Helpers --------------------
const isPersistentId = (id: number | string | undefined): boolean =>
  typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));

// -------------------- Main Component --------------------
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

  // Fetch
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await request<T[]>(apiBaseUrl);
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

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  // Handle drag end
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
            request(`${apiBaseUrl}/${row.id}`, {
              body: JSON.stringify({ ...row, position: index }),
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

  // Editing
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
      const saved = await request<T>(url, {
        body: JSON.stringify(editedRow),
        method,
      });

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

  // Delete
  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === null) {
      return;
    }
    try {
      await request(`${apiBaseUrl}/${rowToDelete}`, { method: "DELETE" });
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

  // Add
  const addRow = useCallback(() => {
    const newRow = createNewRow(data.length);
    setData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [createNewRow, data.length, startEditing]);

  // Update edited row
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
      <Dialog onOpenChange={setDeleteModalOpen} open={deleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteModalOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={confirmDelete} variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------- Cell Renderer --------------------
function renderCell<T extends { id: number | string }>(
  col: ColumnConfig<T>,
  value: T[keyof T] | undefined,
  row: T,
  isEditing: boolean,
  saving: boolean,
  errorMessage: string | undefined,
  updateEditedRow: <K extends keyof T>(key: K, value: T[K]) => void
) {
  const isCheckbox = col.type === "checkbox" || typeof value === "boolean";

  if (isEditing) {
    if (isCheckbox) {
      return (
        <Checkbox
          checked={!!value}
          disabled={saving}
          onCheckedChange={checked =>
            updateEditedRow(col.key, !!checked as T[keyof T])
          }
        />
      );
    }

    if (col.type === "select" && col.options) {
      return (
        <Select
          disabled={saving}
          onValueChange={value_ =>
            updateEditedRow(col.key, value_ as T[keyof T])
          }
          value={String(value ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder={col.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {col.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className="space-y-1">
        <Input
          className={errorMessage ? "border-red-500" : ""}
          disabled={saving}
          onChange={event_ =>
            updateEditedRow(col.key, event_.target.value as T[keyof T])
          }
          placeholder={col.placeholder}
          type={col.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
        />
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      </div>
    );
  }

  // View mode
  if (col.render) {
    return col.render(value as T[keyof T], row);
  }
  if (isCheckbox) {
    return <Checkbox checked={!!value} disabled />;
  }
  return (
    <span className={value ? "" : "text-gray-400"}>{String(value ?? "—")}</span>
  );
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }
  return response.json();
}

// -------------------- Sortable Row --------------------
function SortableRow<T extends { id: number | string }>(properties: {
  cancelEditing: () => void;
  columns: ColumnConfig<T>[];
  editedRow: null | T;
  isEditing: boolean;
  openDeleteConfirmModal: (id: number | string) => void;
  row: T;
  saveRow: () => Promise<void>;
  saving: boolean;
  startEditing: (row: T) => void;
  updateEditedRow: <K extends keyof T>(key: K, value: T[K]) => void;
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
        {isEditing ? (
          <div className="flex gap-2">
            <Button
              className="h-8 w-8 p-0"
              disabled={saving}
              onClick={cancelEditing}
              size="sm"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              className="h-8 w-8 p-0"
              disabled={saving || Object.keys(validationErrors).length > 0}
              onClick={saveRow}
              size="sm"
              variant="default"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              className="h-8 w-8 p-0"
              onClick={() => startEditing(row)}
              size="sm"
              variant="ghost"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {isExistingRecord && (
              <Button
                className={`
                  h-8 w-8 p-0 text-red-600
                  hover:bg-red-50
                `}
                onClick={() => openDeleteConfirmModal(row.id)}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </TableCell>

      {/* Dynamic Columns */}
      {columns.map(col => {
        const value = (isEditing ? editedRow : row)?.[col.key];
        const errorMessage = validationErrors[col.key as string];
        return (
          <TableCell key={String(col.key)}>
            {renderCell(
              col,
              value,
              row,
              isEditing,
              saving,
              errorMessage,
              updateEditedRow
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
