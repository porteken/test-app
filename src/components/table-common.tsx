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
  disabled?: boolean;
  key: keyof T;
  label: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  render?: (_value: T[keyof T], _row: T) => React.ReactNode;
  required?: boolean;
  sortable?: boolean;
  type?: "checkbox" | "date" | "email" | "number" | "select" | "text";
  validate?: (_value: T[keyof T], _row: T) => null | string;
  width?: number | string;
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

export const formatDateForInput = (date: Date | null | string): string => {
  if (!date) {
    return "";
  }

  const dateObject = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(dateObject.getTime())) {
    return "";
  }

  return dateObject.toISOString().split("T")[0];
};

export const formatDateForDisplay = (date: Date | null | string): string => {
  if (!date) {
    return "—";
  }

  const dateObject = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(dateObject.getTime())) {
    return "—";
  }

  return dateObject.toLocaleDateString();
};

export const validateRequired = (
  value: unknown,
  fieldName: string
): null | string => {
  if (value === null || value === undefined || value === "") {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateEmail = (value: unknown): null | string => {
  if (typeof value !== "string") {
    return null;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : "Please enter a valid email address";
};

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
  row: T;
  saving: boolean;
  updateEditedRow: <K extends keyof T>(_key: K, _value: T[K]) => void;
  value: T[keyof T];
}

function CellRendererComponent<T extends { id: RowId }>({
  col,
  errorMessage,
  isEditing,
  row,
  saving,
  updateEditedRow,
  value,
}: CellRendererProperties<T>) {
  const isCheckbox = col.type === "checkbox" || typeof value === "boolean";
  const isDisabled = saving || col.disabled;

  const handleInputChange = useCallback(
    (newValue: string) => {
      let processedValue: T[keyof T];

      switch (col.type) {
        case "date": {
          processedValue = (
            newValue === "" ? null : new Date(newValue)
          ) as T[keyof T];
          break;
        }
        case "number": {
          processedValue = (
            newValue === "" ? null : Number(newValue)
          ) as T[keyof T];
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
          checked={!!value}
          disabled={isDisabled}
          onCheckedChange={handleCheckboxChange}
        />
      );
    }

    if (col.type === "select" && col.options) {
      return (
        <div className="space-y-1">
          <Select
            disabled={isDisabled}
            onValueChange={handleSelectChange}
            value={String(value ?? "")}
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
      case "email": {
        inputType = "email";
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

    const displayValue =
      col.type === "date" && value instanceof Date
        ? formatDateForInput(value)
        : String(value ?? "");

    return (
      <div className="space-y-1">
        <Input
          aria-describedby={
            errorMessage ? `${col.key as string}-error` : undefined
          }
          aria-invalid={!!errorMessage}
          className={errorMessage ? "border-destructive" : ""}
          disabled={isDisabled}
          onChange={event_ => handleInputChange(event_.target.value)}
          placeholder={col.placeholder}
          required={col.required}
          type={inputType}
          value={displayValue}
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

  // View mode rendering
  if (isCheckbox) {
    return <Checkbox aria-label={col.label} checked={!!value} disabled />;
  }

  if (col.render) {
    return <>{col.render(value, row)}</>;
  }

  // Enhanced display formatting
  const displayValue = useMemo(() => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    if (
      col.type === "date" &&
      (value instanceof Date || typeof value === "string")
    ) {
      return formatDateForDisplay(value);
    }

    if (col.type === "number" && typeof value === "number") {
      return value.toLocaleString();
    }

    return String(value);
  }, [value, col.type]);

  return (
    <span className={value ? "" : "text-muted-foreground"}>{displayValue}</span>
  );
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
  title?: string;
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
    title = "Confirm Deletion",
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
            <DialogTitle>{title}</DialogTitle>
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
  description?: string;
  title?: string;
}>(
  ({
    action,
    description = "Try adjusting your filters to see results.",
    title = "No data available",
  }) => {
    return (
      <Alert>
        <AlertDescription>
          <div className="space-y-3 text-center">
            <p className="font-medium">{title}</p>
            <p className="text-muted-foreground">{description}</p>
            {action && <div className="pt-2">{action}</div>}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
);

TableEmptyState.displayName = "TableEmptyState";

// -------------------- Enhanced Error State --------------------
export const TableErrorState = React.memo<{
  error: unknown;
  retry?: () => void;
  retrying?: boolean;
}>(({ error, retry, retrying = false }) => {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  const handleRetry = useCallback(() => {
    if (!retrying && retry) {
      retry();
    }
  }, [retry, retrying]);

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
              disabled={retrying}
              onClick={handleRetry}
              size="sm"
              variant="outline"
            >
              {retrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                "Retry"
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
});

TableErrorState.displayName = "TableErrorState";

// -------------------- Enhanced Loading State --------------------
interface TableLoadingStateProperties {
  message?: string;
  rows?: number;
}

export const TableLoadingState = React.memo<TableLoadingStateProperties>(
  ({ message = "Loading data...", rows = 5 }) => {
    const skeletonRows = Array.from({ length: rows }, (_, index) => index);

    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center space-y-4 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{message}</p>
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
  }
);

TableLoadingState.displayName = "TableLoadingState";

// -------------------- New: Bulk Actions Component --------------------
interface BulkActionsProperties {
  actions?: Array<{
    disabled?: boolean;
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline";
  }>;
  onClearSelection: () => void;
  onSelectAll: () => void;
  selectedCount: number;
  totalCount: number;
}

export const BulkActions = React.memo<BulkActionsProperties>(
  ({
    actions = [],
    onClearSelection,
    onSelectAll,
    selectedCount,
    totalCount,
  }) => {
    if (selectedCount === 0) {
      return null;
    }

    return (
      <div
        className={`
          flex items-center justify-between rounded-md border border-blue-200
          bg-blue-50 p-2
        `}
      >
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">
            {selectedCount} of {totalCount} selected
          </span>
          <div className="flex space-x-2">
            <Button onClick={onSelectAll} size="sm" variant="outline">
              Select All
            </Button>
            <Button onClick={onClearSelection} size="sm" variant="outline">
              Clear Selection
            </Button>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="flex space-x-2">
            {actions.map((action, index) => (
              <Button
                disabled={action.disabled}
                key={index}
                onClick={action.onClick}
                size="sm"
                variant={action.variant || "default"}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

BulkActions.displayName = "BulkActions";
