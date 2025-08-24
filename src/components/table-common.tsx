"use client";

import { AlertCircle, Edit, Loader2, Save, Trash2, X } from "lucide-react";
import React, { useCallback, useMemo } from "react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// -------------------- Enhanced Types --------------------
export interface ColumnConfig<T> {
  key: keyof T;
  label: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  type?: "checkbox" | "date" | "number" | "select" | "text";
  validate?: (_value: T[keyof T], _row: T) => null | string;
}

export type RowId = number | string;

export interface TableState {
  data: unknown[];
  error: Error | null;
  loading: boolean;
}

// -------------------- Enhanced Utils --------------------
export const isPersistentId = (id: RowId | undefined): boolean =>
  typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));

// -------------------- Enhanced Action Buttons --------------------
interface ActionButtonsProperties {
  canDelete?: boolean;
  canEdit?: boolean;
  isEditing: boolean;
  isExistingRecord: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSave: () => void;
  saving: boolean;
  validationErrors: Record<string, string>;
}

export const ActionButtons = React.memo<ActionButtonsProperties>(
  ({
    canDelete = true,
    canEdit = true,
    isEditing,
    isExistingRecord,
    onCancel,
    onDelete,
    onEdit,
    onSave,
    saving,
    validationErrors,
  }) => {
    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    if (isEditing) {
      return (
        <div aria-label="Edit actions" className="flex gap-2" role="group">
          <Button
            aria-label="Cancel editing"
            className="h-8 w-8"
            disabled={saving}
            onClick={onCancel}
            size="icon"
            title="Cancel editing"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Save changes"
            className="h-8 w-8"
            disabled={saving || hasValidationErrors}
            onClick={onSave}
            size="icon"
            title={
              hasValidationErrors
                ? "Fix validation errors to save"
                : "Save changes"
            }
            variant="default"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      );
    }

    return (
      <div aria-label="Row actions" className="flex gap-2" role="group">
        {canEdit && (
          <Button
            aria-label="Edit row"
            className="h-8 w-8"
            onClick={onEdit}
            size="icon"
            title="Edit row"
            variant="ghost"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {canDelete && isExistingRecord && (
          <Button
            aria-label="Delete row"
            className={`
              h-8 w-8 text-destructive
              hover:bg-destructive/10
            `}
            onClick={onDelete}
            size="icon"
            title="Delete row"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);

ActionButtons.displayName = "ActionButtons";

// -------------------- Enhanced Cell Renderer --------------------
interface CellRendererProperties<T extends { id: RowId }> {
  col: ColumnConfig<T>;
  errorMessage?: string;
  isEditing: boolean;
  saving: boolean;
  updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
  value: T[keyof T];
}

export function CellRendererComponent<T extends { id: RowId }>({
  col,
  errorMessage,
  isEditing,
  saving,
  updateEditedRow,
  value,
}: CellRendererProperties<T>) {
  const isCheckbox = col.type === "checkbox" || typeof value === "boolean";

  const displayValue = useMemo(() => {
    if (
      col.type === "date" &&
      (value instanceof Date || typeof value === "string")
    ) {
      if (typeof value === "string") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return "Invalid Date";
        }

        const [year, month, day] = value.split("-").map(Number);
        const localDate = new Date(year, month - 1, day);

        return new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }).format(localDate);
      }

      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Intl.DateTimeFormat(undefined, {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }).format(value);
      }
    }

    if (col.type === "number" && typeof value === "number") {
      return value.toLocaleString();
    }

    return String(value);
  }, [value, col.type]);

  const handleInputChange = useCallback(
    (newValue: string) => {
      let processedValue: T[keyof T];
      switch (col.type) {
        case "date": {
          processedValue = newValue as T[keyof T];
          break;
        }
        case "number": {
          processedValue = Number(newValue) as T[keyof T];
          break;
        }
        default: {
          processedValue = newValue as T[keyof T];
        }
      }
      updateEditedRow(col.key, processedValue);
    },
    [col.key, col.type, updateEditedRow]
  );

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      updateEditedRow(col.key, checked as T[keyof T]);
    },
    [col.key, updateEditedRow]
  );

  const handleSelectChange = useCallback(
    (selectedValue: string) => {
      updateEditedRow(col.key, selectedValue as T[keyof T]);
    },
    [col.key, updateEditedRow]
  );

  if (isEditing) {
    if (isCheckbox) {
      return (
        <Checkbox
          aria-describedby={
            errorMessage ? `${col.key as string}-error` : undefined
          }
          aria-label={col.label}
          checked={!!value}
          disabled={saving}
          onCheckedChange={handleCheckboxChange}
        />
      );
    }

    if (col.type === "select" && col.options) {
      return (
        <div className="space-y-1">
          <Select
            aria-label={col.label}
            disabled={saving}
            onValueChange={handleSelectChange}
            value={String(value)}
          >
            <SelectTrigger
              aria-describedby={
                errorMessage ? `${col.key as string}-error` : undefined
              }
              className={errorMessage ? "border-destructive" : ""}
            >
              <SelectValue placeholder={col.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {col.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorMessage && (
            <p
              className="text-sm text-destructive"
              id={`${col.key as string}-error`}
              role="alert"
            >
              {errorMessage}
            </p>
          )}
        </div>
      );
    }

    let inputType: string;
    switch (col.type) {
      case "date": {
        inputType = "date";
        break;
      }
      case "number": {
        inputType = "number";
        break;
      }
      default: {
        inputType = "text";
      }
    }
    return (
      <div className="space-y-1">
        <Input
          aria-describedby={
            errorMessage ? `${col.key as string}-error` : undefined
          }
          aria-invalid={!!errorMessage}
          aria-label={col.label}
          className={errorMessage ? "border-destructive" : ""}
          disabled={saving}
          onChange={event_ => handleInputChange(event_.target.value)}
          placeholder={col.placeholder}
          type={inputType}
          value={String(value)}
        />
        {errorMessage && (
          <p
            className="text-sm text-destructive"
            id={`${col.key as string}-error`}
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  if (isCheckbox) {
    return <Checkbox aria-label={col.label} checked={!!value} disabled />;
  }

  return <span>{displayValue}</span>;
}

export const CellRenderer = React.memo(
  CellRendererComponent
) as typeof CellRendererComponent;

// -------------------- Enhanced Delete Dialog --------------------
interface DeleteDialogProperties {
  cancelText?: string;
  confirmText?: string;
  description?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export const DeleteDialog = React.memo<DeleteDialogProperties>(
  ({
    cancelText = "Cancel",
    confirmText = "Delete",
    description = "This action cannot be undone. Are you sure you want to delete this record?",
    isDeleting = false,
    onClose,
    onConfirm,
    open,
  }) => {
    const handleConfirm = useCallback(() => {
      if (!isDeleting) {
        onConfirm();
      }
    }, [onConfirm, isDeleting]);

    return (
      <Dialog onOpenChange={onClose} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isDeleting} onClick={onClose} variant="outline">
              {cancelText}
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleConfirm}
              variant="destructive"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                confirmText
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

DeleteDialog.displayName = "DeleteDialog";

// -------------------- Enhanced Empty State --------------------
export const TableEmptyState = React.memo<{
  action?: React.ReactNode;
}>(({ action }) => {
  return (
    <Alert>
      <AlertDescription>
        <div className="space-y-3 text-center">
          <p className="font-medium">No data available</p>
          <p className="text-muted-foreground">
            Try adjusting your filters to see results.
          </p>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </AlertDescription>
    </Alert>
  );
});

TableEmptyState.displayName = "TableEmptyState";

// -------------------- Enhanced Error State --------------------
export const TableErrorState = React.memo<{
  error: unknown;
  retry?: () => void;
}>(({ error, retry }) => {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  return (
    <Alert className="max-w-2xl" variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-3">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm">{message}</p>
          {retry && (
            <Button
              className="mt-2"
              onClick={retry}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
});

TableErrorState.displayName = "TableErrorState";

// -------------------- Enhanced Loading State --------------------

export const TableLoadingState = React.memo(() => {
  const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading data...</p>
      </div>

      {/* Optional: Skeleton loading rows */}
      <div className="space-y-2">
        {skeletonRows.map(index => (
          <div className="flex animate-pulse space-x-4" key={index}>
            <div className="h-4 flex-1 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-4 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
});

TableLoadingState.displayName = "TableLoadingState";
