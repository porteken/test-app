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

interface DraggableRecord {
  customer: string;
  filtered: FilteredStatus;
  id: number | string;
  position: number;
  product: string;
}

type FilteredStatus = "false" | "true";

interface SortableRowProperties {
  cancelEditing: () => void;
  editedRow: DraggableRecord | null;
  isEditing: boolean;
  openDeleteConfirmModal: (id: number | string) => void;
  row: DraggableRecord;
  saveRow: () => Promise<void>;
  saving: boolean;
  startEditing: (row: DraggableRecord) => void;
  updateEditedRow: (updates: Partial<DraggableRecord>) => void;
  validationErrors: ValidationErrors;
}

interface ValidationErrors {
  customer?: string;
  product?: string;
}

const API_BASE_URL = "http://localhost:8000/api/draggable";
const FILTERED_OPTIONS = [
  { label: "True", value: "true" },
  { label: "False", value: "false" },
] as const;

const isPersistentId = (id: number | string | undefined): boolean =>
  typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));

const validateRecord = (record: DraggableRecord): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!record.customer?.trim()) {
    errors.customer = "Customer name is required";
  }

  if (!record.product?.trim()) {
    errors.product = "Product name is required";
  }

  return errors;
};

const createNewRecord = (position: number): DraggableRecord => ({
  customer: "",
  filtered: "false",
  id: `new-${Date.now()}-${Math.random()}`,
  position,
  product: "",
});

const api = {
  async deleteRecord(id: number | string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete: ${response.statusText}`);
    }
  },

  async fetchRecords(): Promise<DraggableRecord[]> {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    return response.json();
  },

  async saveRecord(record: DraggableRecord): Promise<DraggableRecord> {
    const isNew = !isPersistentId(record.id);
    const url = isNew ? API_BASE_URL : `${API_BASE_URL}/${record.id}`;
    const method = isNew ? "POST" : "PUT";

    const payload = {
      customer: record.customer,
      filtered: record.filtered,
      product: record.product,
    };

    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method,
    });

    if (!response.ok) {
      throw new Error(`Failed to save: ${response.statusText}`);
    }

    return response.json();
  },

  async updatePositions(records: DraggableRecord[]): Promise<void> {
    const updates = records.map((row, index) =>
      fetch(`${API_BASE_URL}/${row.id}`, {
        body: JSON.stringify({
          customer: row.customer,
          filtered: row.filtered,
          position: index,
          product: row.product,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      })
    );

    await Promise.all(updates);
  },
};

const SortableRow = React.memo<SortableRowProperties>(
  ({
    cancelEditing,
    editedRow,
    isEditing,
    openDeleteConfirmModal,
    row,
    saveRow,
    saving,
    startEditing,
    updateEditedRow,
    validationErrors,
  }) => {
    const {
      attributes,
      isDragging,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({
      disabled: isEditing,
      id: row.id,
    });

    const style = {
      opacity: isDragging ? 0.8 : 1,
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1 : 0,
    };

    const isExistingRecord = isPersistentId(row.id);

    const handleCustomerChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        updateEditedRow({ customer: event.target.value });
      },
      [updateEditedRow]
    );

    const handleProductChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        updateEditedRow({ product: event.target.value });
      },
      [updateEditedRow]
    );

    const handleFilteredChange = useCallback(
      (value: string) => {
        updateEditedRow({ filtered: (value as FilteredStatus) || "false" });
      },
      [updateEditedRow]
    );

    const handleEdit = useCallback(() => {
      startEditing(row);
    }, [startEditing, row]);

    const handleDelete = useCallback(() => {
      openDeleteConfirmModal(row.id);
    }, [openDeleteConfirmModal, row.id]);

    return (
      <TableRow ref={setNodeRef} style={style} {...attributes}>
        <TableCell className="w-10">
          <div
            {...listeners}
            aria-label="Drag to reorder"
            className={`
              flex items-center justify-center
              ${
                isEditing
                  ? "cursor-not-allowed opacity-50"
                  : `
                    cursor-grab
                    hover:text-gray-600
                  `
              }
            `}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </TableCell>

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
                onClick={handleEdit}
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
                  onClick={handleDelete}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </TableCell>

        <TableCell>
          {isEditing ? (
            <div className="space-y-1">
              <Input
                aria-label="Customer name"
                className={validationErrors.customer ? "border-red-500" : ""}
                disabled={saving}
                onChange={handleCustomerChange}
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

        <TableCell>
          {isEditing ? (
            <div className="space-y-1">
              <Input
                aria-label="Product name"
                className={validationErrors.product ? "border-red-500" : ""}
                disabled={saving}
                onChange={handleProductChange}
                placeholder="Enter product name"
                value={editedRow?.product || ""}
              />
              {validationErrors.product && (
                <p className="text-sm text-red-500">
                  {validationErrors.product}
                </p>
              )}
            </div>
          ) : (
            <span className={row.product ? "" : "text-gray-400"}>
              {row.product || "No product"}
            </span>
          )}
        </TableCell>

        <TableCell className="w-32">
          {isEditing ? (
            <Select
              disabled={saving}
              onValueChange={handleFilteredChange}
              value={editedRow?.filtered || "false"}
            >
              <SelectTrigger aria-label="Filtered status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {FILTERED_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="capitalize">{row.filtered}</span>
          )}
        </TableCell>
      </TableRow>
    );
  }
);

SortableRow.displayName = "SortableRow";

export default function DraggableEditableTable() {
  const [data, setData] = useState<DraggableRecord[]>([]);
  const [editingRowId, setEditingRowId] = useState<null | number | string>(
    null
  );
  const [editedRow, setEditedRow] = useState<DraggableRecord | null>(null);
  const [rowToDelete, setRowToDelete] = useState<null | number | string>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);

  const hasUnsavedChanges = editingRowId !== null;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.fetchRecords();
      setData(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch data";
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

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

      const reorderedData = arrayMove(data, oldIndex, newIndex);

      setData(reorderedData);

      try {
        await api.updatePositions(reorderedData);
        toast.success("Success", {
          description: "Row order updated successfully",
        });
      } catch {
        setData(data);
        toast.error("Error", {
          description: "Failed to update order",
          icon: <AlertCircle className="h-4 w-4" />,
        });
      }
    },
    [data]
  );

  const startEditing = useCallback((row: DraggableRecord) => {
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

    try {
      setSaving(true);
      const savedRecord = await api.saveRecord(editedRow);
      const updatedRecord = { ...editedRow, ...savedRecord };

      setData(currentData =>
        isNew
          ? currentData.map(row =>
              row.id === editingRowId ? updatedRecord : row
            )
          : currentData.map(row =>
              row.id === updatedRecord.id ? updatedRecord : row
            )
      );

      toast.success("Success", {
        description: `Record ${isNew ? "created" : "updated"} successfully`,
      });

      setEditingRowId(null);
      setEditedRow(null);
      setValidationErrors({});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save record";
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
      await api.deleteRecord(rowToDelete);
      setData(currentData => currentData.filter(row => row.id !== rowToDelete));
      toast.success("Success", {
        description: "Record deleted successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete record";
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
    const newRow = createNewRecord(data.length);
    setData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [startEditing, data.length]);

  const updateEditedRow = useCallback((updates: Partial<DraggableRecord>) => {
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
        <Button className="gap-2" disabled={hasUnsavedChanges} onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
        {hasUnsavedChanges && (
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
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead aria-label="Drag handle" className="w-10" />
                  <TableHead className="w-32">Actions</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Filtered</TableHead>
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
