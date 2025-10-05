"use client";

import { Plus } from "lucide-react";
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

// -------------------- Types --------------------
interface EditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
}

// -------------------- Component --------------------
export function EditableTable<T extends { id: number | string }>({
  apiBaseUrl,
  columns,
}: Readonly<EditableTableProperties<T>>) {
  // -------------------- State --------------------
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
  const [error, setError] = useState<Error | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // -------------------- Data Fetching --------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const result: T[] = await response.json();
      setData(result);
    } catch (error_) {
      const errorInstance =
        error_ instanceof Error ? error_ : new Error("Failed to fetch data");
      setError(errorInstance);
      toast.error("Error loading data", { description: errorInstance.message });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------- Row Editing --------------------
  const startEditing = useCallback((row: T) => {
    setEditingRowId(row.id);
    setEditedRow({ ...row });
    setValidationErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    if (editedRow && !isPersistentId(editedRow.id)) {
      setData(current => current.filter(row => row.id !== editedRow.id));
    }
    setEditingRowId(null);
    setEditedRow(null);
    setValidationErrors({});
  }, [editedRow]);

  const saveRow = useCallback(async () => {
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
      const savedRecord: T = await response.json();

      setData(current =>
        isNew
          ? [savedRecord, ...current.filter(r => r.id !== editedRow.id)]
          : current.map(r => (r.id === editingRowId ? savedRecord : r))
      );

      toast.success(`Record ${isNew ? "created" : "updated"} successfully`);
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
  }, [editedRow, editingRowId, apiBaseUrl, columns]);

  // -------------------- Row Deletion --------------------
  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === null) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/${rowToDelete}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }
      setData(current => current.filter(row => row.id !== rowToDelete));
      toast.success("Record deleted successfully");
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
      toast.error("Error deleting record", { description: errorMessage });
    } finally {
      setDeleteModalOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete, apiBaseUrl]);

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

    setData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [columns, startEditing, editingRowId]);

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

  if (loading) {
    return <TableLoadingState />;
  }

  if (error && data.length === 0) {
    return <TableErrorState error={error} retry={fetchData} />;
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
