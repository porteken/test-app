"use client";

import { Plus } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
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

// -------------------- Types --------------------
interface EditableTableProperties<T extends { id: number | string }> {
  columns: ColumnConfig<T>[];
  data: T[];
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onDelete: (_id: number | string) => void;
  onSave: (
    _editedRow: T,
    _isNew: boolean,
    _temporaryId?: number | string
  ) => void;
  refetch: () => void;
  setLocalData: React.Dispatch<React.SetStateAction<T[]>>;
}

// -------------------- Component --------------------
export function EditableTable<T extends { id: number | string }>({
  columns,
  data,
  error,
  isError,
  isLoading,
  isSaving,
  onDelete,
  onSave,
  refetch,
  setLocalData,
}: Readonly<EditableTableProperties<T>>) {
  // -------------------- State --------------------
  const [editingRowId, setEditingRowId] = useState<null | number | string>(
    null
  );
  const [editedRow, setEditedRow] = useState<null | T>(null);
  const [rowToDelete, setRowToDelete] = useState<null | number | string>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // -------------------- Row Editing --------------------
  const startEditing = useCallback((row: T) => {
    setEditingRowId(row.id);
    setEditedRow({ ...row });
    setValidationErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    if (editedRow && !isPersistentId(editedRow.id)) {
      setLocalData(current => current.filter(row => row.id !== editedRow.id));
    }
    setEditingRowId(null);
    setEditedRow(null);
    setValidationErrors({});
  }, [editedRow, setLocalData]);

  const saveRow = useCallback(() => {
    if (!editedRow) {
      return;
    }

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
    onSave(editedRow, isNew, isNew ? editedRow.id : undefined);

    // Reset editing state after save
    setEditingRowId(null);
    setEditedRow(null);
    setValidationErrors({});
  }, [editedRow, columns, onSave]);

  // -------------------- Row Deletion --------------------
  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (rowToDelete !== null) {
      onDelete(rowToDelete);
      setDeleteModalOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete, onDelete]);

  // -------------------- Row Addition --------------------
  const addRow = useCallback(() => {
    if (editingRowId !== null) {
      toast.warning("Please save or cancel your current changes first.");
      return;
    }

    const newRow = { id: `new-${Date.now()}` } as T;

    // Initialize columns with default values
    for (const col of columns) {
      const key = col.key;
      if (col.type === "checkbox") {
        newRow[key] = false as T[typeof key];
      } else if (col.type === "date") {
        newRow[key] = new Date().toISOString().split("T")[0] as T[typeof key];
      } else {
        newRow[key] = "" as T[typeof key];
      }
    }

    setLocalData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [columns, startEditing, editingRowId, setLocalData]);

  // -------------------- Field Updates --------------------
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
  const isEditing = editingRowId !== null;

  const addRowButton = useMemo(
    () => (
      <Button className="gap-2" disabled={isEditing} onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add Row
      </Button>
    ),
    [isEditing, addRow]
  );

  if (isLoading) {
    return <TableLoadingState />;
  }

  if (isError && data.length === 0) {
    return <TableErrorState error={error} retry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        {addRowButton}
        {isEditing && (
          <p className="text-sm text-destructive">
            Finish editing to add a new row
          </p>
        )}
      </div>

      {/* Table */}
      {data.length === 0 && !isEditing ? (
        <TableEmptyState action={addRowButton} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Actions</TableHead>
                {columns.map(col => (
                  <TableHead key={String(col.key)}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => {
                const isEditing = editingRowId === row.id;
                const isExistingRecord = isPersistentId(row.id);
                const safeRow = (isEditing ? editedRow : row) as T;

                return (
                  <TableRow
                    className={isEditing ? "bg-yellow-50" : ""}
                    key={row.id}
                  >
                    {/* Actions */}
                    <TableCell>
                      <ActionButtons
                        isEditing={isEditing}
                        isExistingRecord={isExistingRecord}
                        onCancel={cancelEditing}
                        onDelete={() => openDeleteConfirmModal(row.id)}
                        onEdit={() => startEditing(row)}
                        onSave={saveRow}
                        saving={isSaving}
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
                            saving={isSaving}
                            updateEditedRow={updateEditedRow}
                            value={value}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        open={deleteModalOpen}
      />
    </div>
  );
}
