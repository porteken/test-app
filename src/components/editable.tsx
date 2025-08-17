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

interface EditableRecord {
  bought: boolean;
  customer: string;
  date: string; // Stored as 'YYYY-MM-DD'
  id: number | string;
}

interface ValidationErrors {
  customer?: string;
  date?: string;
}

const API_BASE_URL = "http://localhost:8000/api/editable";

const isPersistentId = (id: number | string | undefined): boolean =>
  typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));

const convertDateToString = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseStringToDate = (dateString: null | string | undefined): string => {
  if (!dateString) {
    return "";
  }
  return dateString;
};

const validateRecord = (record: EditableRecord): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!record.customer.trim()) {
    errors.customer = "Customer name is required";
  }

  if (!record.date) {
    errors.date = "Date is required";
  }

  return errors;
};

export default function EditableTable() {
  const [data, setData] = useState<EditableRecord[]>([]);
  const [editingRowId, setEditingRowId] = useState<null | number | string>(
    null
  );
  const [editedRow, setEditedRow] = useState<EditableRecord | null>(null);
  const [rowToDelete, setRowToDelete] = useState<null | number | string>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(API_BASE_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to fetch data";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEditing = useCallback((row: EditableRecord) => {
    setEditingRowId(row.id);
    setEditedRow({ ...row });
    setValidationErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    if (editedRow && !isPersistentId(editedRow.id)) {
      setData(currentData =>
        currentData.filter(row => row.id !== editedRow.id)
      );
    }
    setEditingRowId(null);
    setEditedRow(null);
    setValidationErrors({});
  }, [editedRow]);

  const saveRow = useCallback(async () => {
    if (!editedRow) {
      return;
    }

    const errors = validateRecord(editedRow);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const isNew = !isPersistentId(editedRow.id);
    const url = isNew ? API_BASE_URL : `${API_BASE_URL}/${editedRow.id}`;
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
      setData(currentData =>
        currentData.map(row => (row.id === editingRowId ? savedRecord : row))
      );

      toast.success("Success", {
        description: `Record ${isNew ? "created" : "updated"} successfully`,
      });

      setEditingRowId(null);
      setEditedRow(null);
      setValidationErrors({});
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to save record";
      toast.error("Error", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setSaving(false);
    }
  }, [editedRow, editingRowId]);

  const openDeleteConfirmModal = useCallback((id: number | string) => {
    setRowToDelete(id);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === null) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/${rowToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }

      setData(currentData => currentData.filter(row => row.id !== rowToDelete));
      toast.success("Success", {
        description: "Record deleted successfully",
      });
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
      toast.error("Error", {
        description: errorMessage,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setDeleteModalOpen(false);
      setRowToDelete(null);
    }
  }, [rowToDelete]);

  const addRow = useCallback(() => {
    const newRow: EditableRecord = {
      bought: false,
      customer: "",
      date: convertDateToString(new Date()),
      id: `new-${Date.now()}`,
    };
    setData(previous => [newRow, ...previous]);
    setEditingRowId(newRow.id);
    setEditedRow(newRow);
    setValidationErrors({});
  }, []);

  const updateEditedRow = useCallback((updates: Partial<EditableRecord>) => {
    setEditedRow(previous => (previous ? { ...previous, ...updates } : null));
    setValidationErrors(previous => {
      const newErrors = { ...previous };
      for (const key of Object.keys(updates)) {
        delete newErrors[key as keyof ValidationErrors];
      }
      return newErrors;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-gray-600">Loading data...</p>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <Alert className="max-w-2xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div>
            <strong>Error loading data</strong>
            <p>{error}</p>
          </div>
          <Button onClick={fetchData} variant="outline">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
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
          <p className="text-sm text-orange-600">
            Finish editing the current row before adding a new one
          </p>
        )}
      </div>

      {data.length === 0 ? (
        <Alert>
          <AlertDescription>
            <div>
              <strong>No data available</strong>
              <p>
                No records found. Click &quot;Add Row&quot; to create your first
                record.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Actions</TableHead>
                <TableHead className="w-32">Bought</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => {
                const isEditing = editingRowId === row.id;
                const isExistingRecord = isPersistentId(row.id);

                return (
                  <TableRow key={row.id}>
                    {/* Actions */}
                    <TableCell className="w-32">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            aria-label="Cancel editing"
                            className="h-8 w-8 p-0"
                            disabled={saving}
                            onClick={cancelEditing}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label="Save changes"
                            className="h-8 w-8 p-0"
                            disabled={saving}
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
                            aria-label="Edit row"
                            className="h-8 w-8 p-0"
                            onClick={() => startEditing(row)}
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isExistingRecord && (
                            <Button
                              aria-label="Delete row"
                              className={`
                                h-8 w-8 p-0 text-red-600
                                hover:bg-red-50 hover:text-red-700
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

                    {/* Bought */}
                    <TableCell className="w-32">
                      {isEditing ? (
                        <Checkbox
                          checked={editedRow?.bought || false}
                          disabled={saving}
                          onCheckedChange={checked =>
                            updateEditedRow({ bought: !!checked })
                          }
                        />
                      ) : (
                        <Checkbox checked={row.bought} disabled />
                      )}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            className={
                              validationErrors.customer ? "border-red-500" : ""
                            }
                            disabled={saving}
                            onChange={event =>
                              updateEditedRow({ customer: event.target.value })
                            }
                            placeholder="Enter customer name"
                            value={editedRow?.customer || ""}
                          />
                          {validationErrors.customer && (
                            <p className="text-sm text-red-500">
                              {validationErrors.customer}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className={row.customer ? "" : "text-gray-400"}>
                          {row.customer || "No customer"}
                        </span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            className={
                              validationErrors.date ? "border-red-500" : ""
                            }
                            disabled={saving}
                            onChange={event =>
                              updateEditedRow({ date: event.target.value })
                            }
                            type="date"
                            value={parseStringToDate(editedRow?.date)}
                          />
                          {validationErrors.date && (
                            <p className="text-sm text-red-500">
                              {validationErrors.date}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className={row.date ? "" : "text-gray-400"}>
                          {row.date || "No date"}
                        </span>
                      )}
                    </TableCell>
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
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be
              undone.
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
