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
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconGripVertical,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

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
      (value: null | string) => {
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
      <Table.Tr ref={setNodeRef} style={style} {...attributes}>
        <Table.Td>
          <div
            {...listeners}
            aria-label="Drag to reorder"
            style={{
              cursor: isEditing ? "not-allowed" : "grab",
              opacity: isEditing ? 0.5 : 1,
            }}
          >
            <IconGripVertical size={18} />
          </div>
        </Table.Td>

        <Table.Td>
          {isEditing ? (
            <Group gap="xs">
              <ActionIcon
                aria-label="Cancel editing"
                color="gray"
                disabled={saving}
                onClick={cancelEditing}
                variant="subtle"
              >
                <IconX size={16} />
              </ActionIcon>
              <ActionIcon
                aria-label="Save changes"
                color="green"
                loading={saving}
                onClick={saveRow}
                variant="filled"
              >
                <IconDeviceFloppy size={16} />
              </ActionIcon>
            </Group>
          ) : (
            <Group gap="xs">
              <ActionIcon
                aria-label="Edit row"
                color="blue"
                onClick={handleEdit}
                variant="subtle"
              >
                <IconEdit size={16} />
              </ActionIcon>
              {isExistingRecord && (
                <ActionIcon
                  aria-label="Delete row"
                  color="red"
                  onClick={handleDelete}
                  variant="subtle"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
          )}
        </Table.Td>

        <Table.Td>
          {isEditing ? (
            <TextInput
              aria-label="Customer name"
              disabled={saving}
              error={validationErrors.customer}
              onChange={handleCustomerChange}
              placeholder="Enter customer name"
              value={editedRow?.customer || ""}
            />
          ) : (
            <Text>
              {row.customer || (
                <Text c="dimmed" span>
                  No customer
                </Text>
              )}
            </Text>
          )}
        </Table.Td>

        <Table.Td>
          {isEditing ? (
            <TextInput
              aria-label="Product name"
              disabled={saving}
              error={validationErrors.product}
              onChange={handleProductChange}
              placeholder="Enter product name"
              value={editedRow?.product || ""}
            />
          ) : (
            <Text>
              {row.product || (
                <Text c="dimmed" span>
                  No product
                </Text>
              )}
            </Text>
          )}
        </Table.Td>

        <Table.Td>
          {isEditing ? (
            <Select
              aria-label="Filtered status"
              data={FILTERED_OPTIONS}
              disabled={saving}
              onChange={handleFilteredChange}
              placeholder="Select status"
              value={editedRow?.filtered || "false"}
            />
          ) : (
            <Text tt="capitalize">{row.filtered}</Text>
          )}
        </Table.Td>
      </Table.Tr>
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

  const [deleteModalOpen, { close: closeDeleteModal, open: openDeleteModal }] =
    useDisclosure(false);

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
      notifications.show({
        color: "red",
        icon: <IconAlertCircle />,
        message: errorMessage,
        title: "Error",
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
        notifications.show({
          color: "green",
          message: "Row order updated successfully",
          title: "Success",
        });
      } catch {
        setData(data);
        notifications.show({
          color: "red",
          icon: <IconAlertCircle />,
          message: "Failed to update order",
          title: "Error",
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

      notifications.show({
        color: "green",
        message: `Record ${isNew ? "created" : "updated"} successfully`,
        title: "Success",
      });

      setEditingRowId(null);
      setEditedRow(null);
      setValidationErrors({});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save record";
      notifications.show({
        color: "red",
        icon: <IconAlertCircle />,
        message: errorMessage,
        title: "Error",
      });
    } finally {
      setSaving(false);
    }
  }, [editedRow, editingRowId]);

  const openDeleteConfirmModal = useCallback(
    (id: number | string) => {
      setRowToDelete(id);
      openDeleteModal();
    },
    [openDeleteModal]
  );

  const confirmDelete = useCallback(async () => {
    if (rowToDelete === null) {
      return;
    }

    try {
      await api.deleteRecord(rowToDelete);
      setData(currentData => currentData.filter(row => row.id !== rowToDelete));
      notifications.show({
        color: "green",
        message: "Record deleted successfully",
        title: "Success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete record";
      notifications.show({
        color: "red",
        icon: <IconAlertCircle />,
        message: errorMessage,
        title: "Error",
      });
    } finally {
      closeDeleteModal();
      setRowToDelete(null);
    }
  }, [rowToDelete, closeDeleteModal]);

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
      <Stack align="center" p="xl">
        <Loader size="lg" />
        <Text>Loading data...</Text>
      </Stack>
    );
  }

  if (error && data.length === 0) {
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle />}
        title="Error loading data"
        variant="light"
      >
        <Text>{error}</Text>
        <Button mt="md" onClick={fetchData} variant="light">
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button
          disabled={hasUnsavedChanges}
          leftSection={<IconPlus size={16} />}
          onClick={addRow}
        >
          Add Row
        </Button>
        {hasUnsavedChanges && (
          <Text c="orange" size="sm">
            Finish editing the current row before adding a new one
          </Text>
        )}
      </Group>

      {data.length === 0 ? (
        <Alert color="blue" title="No data available" variant="light">
          <Text>
            No records found. Click &quot;Add Row&quot; to create your first
            record.
          </Text>
        </Alert>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <Table highlightOnHover striped withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th aria-label="Drag handle" style={{ width: 40 }} />
                <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Product</Table.Th>
                <Table.Th style={{ width: 120 }}>Filtered</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
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
            </Table.Tbody>
          </Table>
        </DndContext>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        centered
        onClose={closeDeleteModal}
        opened={deleteModalOpen}
        title="Confirm Delete"
      >
        <Stack>
          <Text>
            Are you sure you want to delete this record? This action cannot be
            undone.
          </Text>
          <Group justify="flex-end">
            <Button onClick={closeDeleteModal} variant="default">
              Cancel
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
