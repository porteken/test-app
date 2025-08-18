"use client";

import {
  AlertCircle,
  Edit,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
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
  placeholder?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  type?: "checkbox" | "date" | "text";
  validate?: (value: T[keyof T], row: T) => null | string;
}

interface EditableTableProperties<T extends { id: number | string }> {
  apiBaseUrl: string;
  columns: ColumnConfig<T>[];
}

// -------------------- Helpers --------------------
const isPersistentId = (id: number | string | undefined): boolean =>
  typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));

const formatDateForInput = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().split("T")[0];
};

// -------------------- Generic Editable Table --------------------
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

  // -------------------- Update Edited Row (type-safe) --------------------
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

                return (
                  <TableRow
                    className={isEditing ? "bg-yellow-50" : ""}
                    key={row.id}
                  >
                    {/* Actions */}
                    <TableCell>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              className="h-8 w-8"
                              disabled={saving}
                              onClick={cancelEditing}
                              size="icon"
                              variant="ghost"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              className="h-8 w-8"
                              disabled={
                                saving ||
                                Object.keys(validationErrors).length > 0
                              }
                              onClick={saveRow}
                              size="icon"
                              variant="default"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              className="h-8 w-8"
                              onClick={() => startEditing(row)}
                              size="icon"
                              variant="ghost"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isExistingRecord && (
                              <Button
                                className={`
                                  h-8 w-8 text-destructive
                                  hover:bg-destructive/10 hover:text-destructive
                                `}
                                onClick={() => openDeleteConfirmModal(row.id)}
                                size="icon"
                                variant="ghost"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>

                    {/* Dynamic Columns */}
                    {columns.map(col => {
                      if (isEditing && !editedRow) {
                        return null;
                      }

                      const safeRow = (isEditing ? editedRow : row) as T;
                      const value = safeRow[col.key];
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
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog onOpenChange={setDeleteModalOpen} open={deleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to permanently
              delete this record?
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
  value: T[keyof T],
  row: T,
  isEditing: boolean,
  saving: boolean,
  errorMessage: string | undefined,
  updateEditedRow: <K extends keyof T>(key: K, value: T[K]) => void
) {
  const isCheckbox = col.type === "checkbox" || typeof value === "boolean";

  if (isEditing) {
    return (
      <div className="space-y-1">
        {isCheckbox ? (
          <Checkbox
            checked={!!value}
            disabled={saving}
            onCheckedChange={checked =>
              updateEditedRow(col.key, !!checked as T[keyof T])
            }
          />
        ) : (
          <Input
            className={errorMessage ? "border-destructive" : ""}
            disabled={saving}
            onChange={event_ =>
              updateEditedRow(col.key, event_.target.value as T[keyof T])
            }
            placeholder={col.placeholder}
            type={col.type === "date" ? "date" : "text"}
            value={String(value ?? "")}
          />
        )}
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  }

  // View mode
  if (isCheckbox) {
    return <Checkbox checked={!!value} disabled />;
  }

  if (col.render) {
    return col.render(value, row);
  }

  return (
    <span className={value ? "" : "text-muted-foreground"}>
      {String(value) || "—"}
    </span>
  );
}
