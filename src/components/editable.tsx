"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
  createNewRow: () => T;
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
}

// -------------------- Component --------------------
export function EditableTable<T extends { id: number | string }>({
  columns,
  createNewRow,
  data: externalData,
  error,
  isError,
  isLoading,
  isSaving,
  onDelete,
  onSave,
  refetch,
}: Readonly<EditableTableProperties<T>>) {
  // -------------------- State --------------------
  const [localData, setLocalData] = useState<T[]>([]);
  const [editingRowId, setEditingRowId] = useState<null | number | string>(
    null
  );
  const [editedRow, setEditedRow] = useState<null | T>(null);
  const [rowToDelete, setRowToDelete] = useState<null | number | string>(null);
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
    const temporaryId = isNew ? editedRow.id : undefined;

    onSave(editedRow, isNew, temporaryId);

    // Remove temporary row from local data after save
    if (isNew && temporaryId) {
      setLocalData(current => current.filter(row => row.id !== temporaryId));
    }

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

    const newRow = createNewRow();
    setLocalData(previous => [newRow, ...previous]);
    startEditing(newRow);
  }, [createNewRow, startEditing, editingRowId]);

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

  // -------------------- Table Columns --------------------
  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
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

    return [actionColumn, ...dataColumns];
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
              {table.getRowModel().rows.map(row => {
                const isEditingRow = editingRowId === row.original.id;

                return (
                  <TableRow
                    className={isEditingRow ? "bg-yellow-50" : ""}
                    key={row.id}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
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
