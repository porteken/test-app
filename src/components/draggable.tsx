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
import React, { useCallback, useEffect, useMemo } from "react";
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
  useEditableTable,
} from "./table-common";

// -------------------- Types --------------------
interface ActionCellProperties<T> {
  cancelEditing: () => void;
  isEditing: boolean;
  isExistingRecord: boolean;
  isSaving: boolean;
  openDeleteConfirmModal: (_id: number | string) => void;
  row: T;
  rowId: number | string;
  saveRow: () => void;
  startEditing: (_row: T) => void;
  validationErrors: Record<string, string>;
}

interface DataCellProperties<T> {
  col: ColumnConfig<T>;
  errorMessage: string | undefined;
  isEditing: boolean;
  isSaving: boolean;
  updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
  value: T[keyof T];
}

interface DragCellProperties {
  disabled: boolean;
}

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

// -------------------- Cell Renderer Components --------------------
function ActionCell<T extends { id: number | string }>({
  cancelEditing,
  isEditing,
  isExistingRecord,
  isSaving,
  openDeleteConfirmModal,
  row,
  rowId,
  saveRow,
  startEditing,
  validationErrors,
}: Readonly<ActionCellProperties<T>>) {
  return (
    <ActionButtons
      isEditing={isEditing}
      isExistingRecord={isExistingRecord}
      onCancel={cancelEditing}
      onDelete={() => openDeleteConfirmModal(rowId)}
      onEdit={() => startEditing(row)}
      onSave={saveRow}
      saving={isSaving}
      validationErrors={validationErrors}
    />
  );
}

function DataCell<T extends { id: number | string }>({
  col,
  errorMessage,
  isEditing,
  isSaving,
  updateEditedRow,
  value,
}: Readonly<DataCellProperties<T>>) {
  return (
    <CellRenderer
      col={col}
      errorMessage={errorMessage}
      isEditing={isEditing}
      saving={isSaving}
      updateEditedRow={updateEditedRow}
      value={value}
    />
  );
}

const DragCell = React.memo<DragCellProperties>(({ disabled }) => (
  <button
    aria-label="Drag to reorder"
    className={`
      flex h-full w-full items-center justify-center
      ${disabled ? "cursor-not-allowed opacity-50" : "cursor-grab"}
    `}
    disabled={disabled}
    type="button"
  >
    <GripVertical className="h-4 w-4" />
  </button>
));
DragCell.displayName = "DragCell";

// -------------------- Component --------------------
export function DraggableEditableTable<T extends { id: number | string }>({
  columns,
  createNewRow: createNewRowWithPosition,
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
  // Wrap createNewRow to match hook signature
  const createNewRowWrapper = useCallback(
    () => createNewRowWithPosition(0),
    [createNewRowWithPosition]
  );

  // -------------------- Use Shared Hook --------------------
  const {
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
    createNewRow: createNewRowWrapper,
    externalData,
    isSaving,
    onDelete,
    onSave,
  });

  const sortableIds = useMemo(() => data.map(item => item.id), [data]);
  const hasUnsavedChanges = editingRowId !== null;

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

  // -------------------- Keyboard handlers --------------------
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editingRowId === null) {
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

  // -------------------- Custom Add Row (with position) --------------------
  const addRow = useCallback(() => {
    if (editingRowId !== null) {
      toast.warning("Please save or cancel your current changes first.");
      return;
    }
    const newRow = createNewRowWithPosition(data.length);
    startEditing(newRow);
  }, [createNewRowWithPosition, data.length, startEditing, editingRowId]);

  // -------------------- Table Columns --------------------
  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const dragColumn: ColumnDef<T> = {
      cell: ({ row }) => {
        const isEditingRow = editingRowId === row.original.id;
        return <DragCell disabled={isEditingRow} />;
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
          <ActionCell
            cancelEditing={cancelEditing}
            isEditing={isEditingRow}
            isExistingRecord={isExistingRecord}
            isSaving={isSaving}
            openDeleteConfirmModal={openDeleteConfirmModal}
            row={rowData}
            rowId={rowData.id}
            saveRow={saveRow}
            startEditing={startEditing}
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
          <DataCell
            col={col}
            errorMessage={errorMessage}
            isEditing={isEditingRow}
            isSaving={isSaving}
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
  editingRowId: null | number | string;
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
