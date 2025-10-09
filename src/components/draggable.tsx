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
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
  columns: ColumnConfig<T>[];
  createNewRow: (_position: number) => T;
  data: T[];
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onDelete: (_id: number | string) => void;
  onReorder: (_reorderedData: T[]) => void;
  onSave: (
    _editedRow: T,
    _isNew: boolean,
    _temporaryId?: number | string
  ) => void;
  refetch: () => void;
}
type RowType = number | string | undefined;
// -------------------- Component --------------------
export function DraggableEditableTable<T extends { id: number | string }>({
  columns,
  createNewRow,
  data: externalData,
  error,
  isError,
  isLoading,
  isSaving,
  onDelete,
  onReorder,
  onSave,
  refetch,
}: Readonly<DraggableEditableTableProperties<T>>) {
  const [localData, setLocalData] = useState<T[]>([]);
  const [editingRowId, setEditingRowId] = useState<RowType>();
  const [editedRow, setEditedRow] = useState<T | undefined>();
  const [rowToDelete, setRowToDelete] = useState<RowType>();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // -------------------- Merged Data --------------------
  // Combine external data with local temporary rows
  const data = useMemo(() => {
    if (externalData) {
      // Preserve any new unsaved rows
      const newRows = localData.filter(row => !isPersistentId(row.id));
      return [...newRows, ...externalData];
    }
    return localData;
  }, [externalData, localData]);

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);
  const hasUnsavedChanges = editingRowId !== undefined;

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
      onReorder(reordered);
    },
    [data, onReorder]
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
    const temporaryId = isNew ? editedRow.id : undefined;

    onSave(editedRow, isNew, temporaryId);

    // Remove temporary row from local data after save
    if (isNew && temporaryId) {
      setLocalData(current => current.filter(row => row.id !== temporaryId));
    }

    // Reset editing state after save
    setEditingRowId(undefined);
    setEditedRow(undefined);
    setValidationErrors({});
  }, [editedRow, columns, onSave]);

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
      onDelete(rowToDelete);
      setDeleteModalOpen(false);
      setRowToDelete(undefined);
    }
  }, [rowToDelete, onDelete]);

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

  // -------------------- Table Columns --------------------
  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const dragColumn: ColumnDef<T> = {
      cell: ({ row }) => {
        const rowData = row.original;
        const isEditingRow = editingRowId === rowData.id;

        return (
          <button
            aria-label="Drag to reorder"
            className={`
              flex h-full w-full items-center justify-center
              ${isEditingRow ? "cursor-not-allowed opacity-50" : "cursor-grab"}
            `}
            disabled={isEditingRow}
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        );
      },
      header: "",
      id: "drag",
      size: 40,
    };

    const actionColumn: ColumnDef<T> = {
      cell: ({ row }) => {
        const rowData = row.original;
        const isEditingRow = editingRowId === rowData.id;
        const isExistingRecord = isPersistentId(rowData.id);

        return (
          <ActionButtons
            isEditing={isEditingRow}
            isExistingRecord={isExistingRecord}
            onCancel={cancelEditing}
            onDelete={() => openDeleteConfirmModal(rowData.id)}
            onEdit={() => startEditing(rowData)}
            onSave={saveRow}
            saving={isSaving}
            validationErrors={validationErrors}
          />
        );
      },
      header: "Actions",
      id: "actions",
      size: 130,
    };

    const dataColumns: ColumnDef<T>[] = columns.map(col => ({
      accessorKey: col.key as string,
      cell: ({ row }) => {
        const rowData = row.original;
        const isEditingRow = editingRowId === rowData.id;
        const safeRow = (isEditingRow ? editedRow : rowData) as T;
        const value = safeRow[col.key];
        const errorMessage = validationErrors[col.key as string];

        return (
          <CellRenderer
            col={col}
            errorMessage={errorMessage}
            isEditing={isEditingRow}
            saving={isSaving}
            updateEditedRow={updateEditedRow}
            value={value}
          />
        );
      },
      header: col.label,
      id: String(col.key),
    }));

    return [dragColumn, actionColumn, ...dataColumns];
  }, [
    columns,
    editingRowId,
    editedRow,
    validationErrors,
    isSaving,
    cancelEditing,
    openDeleteConfirmModal,
    startEditing,
    saveRow,
    updateEditedRow,
  ]);

  // -------------------- React Table --------------------
  const table = useReactTable({
    columns: tableColumns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

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
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {table.getRowModel().rows.map(row => (
                  <SortableTableRow
                    editingRowId={editingRowId}
                    key={row.id}
                    row={row}
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

// -------------------- Sortable Table Row --------------------
function SortableTableRow<T extends { id: number | string }>({
  editingRowId,
  row,
}: Readonly<{
  editingRowId: number | string | undefined;
  row: import("@tanstack/react-table").Row<T>;
}>) {
  const rowData = row.original;
  const isEditing = editingRowId === rowData.id;

  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled: isEditing, id: rowData.id });

  const style = {
    opacity: isDragging ? 0.8 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <TableRow
      className={isEditing ? "bg-yellow-50" : ""}
      ref={setNodeRef}
      style={style}
    >
      {row.getVisibleCells().map(cell => {
        // Apply drag listeners to the drag handle cell
        const isDragCell = cell.column.id === "drag";
        return (
          <TableCell key={cell.id}>
            {isDragCell ? (
              <div {...listeners} {...attributes}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
