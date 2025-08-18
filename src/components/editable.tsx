"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
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
  formatDateForInput,
  isPersistentId,
} from "./table-common";

// -------------------- Props --------------------
interface EditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
}

// -------------------- Component --------------------
export function EditableTable<T extends { id: number | string }>({
  apiBaseUrl,
  columns,
}: EditableTableProperties<T>) {
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
      toast.error("Error loading data", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------- Editing --------------------
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
      const savedRecord = await response.json();

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
      toast.error("Error saving record", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setSaving(false);
    }
  }, [editedRow, editingRowId, apiBaseUrl, columns]);

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
      const response = await fetch(`${apiBaseUrl}/${rowToDelete}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }
      const deletedRow = data.find(r => r.id === rowToDelete);
      setData(current => current.filter(row => row.id !== rowToDelete));

      toast("Record deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            if (deletedRow) {
              setData(current => [deletedRow, ...current]);
            }
          },
        },
        description: "You can undo this action",
      });
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
      toast.error("Error deleting record", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setDeleteModalOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete, data, apiBaseUrl]);

  // -------------------- Add --------------------
  const addRow = useCallback(() => {
    const newRow: any = { id: `new-${Date.now()}` };
    for (const col of columns) {
      if (col.type === "checkbox") {
        newRow[col.key] = false;
      } else if (col.type === "date") {
        newRow[col.key] = formatDateForInput(new Date());
      } else {
        newRow[col.key] = "";
      }
    }
    setData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [columns, startEditing]);

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
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Error loading data</p>
              <p>{error}</p>
              <Button onClick={fetchData} size="sm" variant="outline">
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Row */}
      <div className="flex items-center justify-between">
        <Button
          className="gap-2"
          disabled={editingRowId !== null}
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
        {editingRowId !== null && (
          <p className="text-sm text-destructive">
            Finish editing the current row before adding a new one
          </p>
        )}
      </div>

      {/* Table */}
      {data.length === 0 && !editingRowId ? (
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="font-medium">No data available</p>
            <p>Click &quot;Add Row&quot; to create your first record.</p>
          </AlertDescription>
        </Alert>
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
