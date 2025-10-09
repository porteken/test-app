"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import React, { useMemo } from "react";

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
  ColumnConfig,
  createTableColumns,
  DeleteDialog,
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
  useEditableTable,
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
  // -------------------- Use Shared Hook --------------------
  const {
    addRow,
    cancelEditing,
    confirmDelete,
    data,
    deleteModalOpen,
    editedRow,
    editingRowId,
    openDeleteConfirmModal,
    saveRow,
    setDeleteModalOpen,
    startEditing,
    updateEditedRow,
    validationErrors,
  } = useEditableTable({
    columns,
    createNewRow,
    externalData,
    isSaving,
    onDelete,
    onSave,
  });

  // -------------------- Table Columns --------------------
  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      createTableColumns({
        cancelEditing,
        columns,
        editedRow,
        editingRowId,
        isSaving,
        openDeleteConfirmModal,
        saveRow,
        startEditing,
        updateEditedRow,
        validationErrors,
      }),
    [
      cancelEditing,
      columns,
      editedRow,
      editingRowId,
      isSaving,
      openDeleteConfirmModal,
      saveRow,
      startEditing,
      updateEditedRow,
      validationErrors,
    ]
  );

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
