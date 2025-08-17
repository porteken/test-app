"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useState } from "react";
import "@mantine/dates/styles.css";
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

const convertPickerOutputToString = (
  pickerOutput: Date | null | string
): string => {
  if (!pickerOutput) {
    return "";
  }
  const date = new Date(pickerOutput);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseYMDStringToDate = (
  dateString: null | string | undefined
): Date | null => {
  if (!dateString) {
    return null;
  }
  return new Date(`${dateString}T00:00:00`);
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
  const [deleteModalOpen, { close: closeDeleteModal, open: openDeleteModal }] =
    useDisclosure(false);

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

      notifications.show({
        color: "green",
        message: `Record ${isNew ? "created" : "updated"} successfully`,
        title: "Success",
      });

      setEditingRowId(null);
      setEditedRow(null);
      setValidationErrors({});
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to save record";
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
      const response = await fetch(`${API_BASE_URL}/${rowToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }

      setData(currentData => currentData.filter(row => row.id !== rowToDelete));
      notifications.show({
        color: "green",
        message: "Record deleted successfully",
        title: "Success",
      });
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to delete record";
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
    const newRow: EditableRecord = {
      bought: false,
      customer: "",
      date: convertPickerOutputToString(new Date()),
      id: `new-${Date.now()}`,
    };
    setData(previous => [newRow, ...previous]);
    setEditingRowId(newRow.id);
    setEditedRow(newRow);
    setValidationErrors({});
  }, []);

  const updateEditedRow = useCallback((updates: Partial<EditableRecord>) => {
    setEditedRow(previous => (previous ? { ...previous, ...updates } : null));
    // Clear validation errors for fields being updated
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

  const rows = data.map(row => {
    const isEditing = editingRowId === row.id;
    const isExistingRecord = isPersistentId(row.id);

    return (
      <Table.Tr key={row.id}>
        {/* Actions Column */}
        <Table.Td>
          {isEditing ? (
            <Group gap="xs">
              <ActionIcon
                aria-label="Cancel"
                color="gray"
                disabled={saving}
                onClick={cancelEditing}
              >
                <IconX />
              </ActionIcon>
              <ActionIcon
                aria-label="Save"
                color="green"
                loading={saving}
                onClick={saveRow}
              >
                <IconDeviceFloppy />
              </ActionIcon>
            </Group>
          ) : (
            <Group gap="xs">
              <ActionIcon
                aria-label="Edit"
                color="blue"
                onClick={() => startEditing(row)}
              >
                <IconEdit />
              </ActionIcon>
              {isExistingRecord && (
                <ActionIcon
                  aria-label="Delete"
                  color="red"
                  onClick={() => openDeleteConfirmModal(row.id)}
                >
                  <IconTrash />
                </ActionIcon>
              )}
            </Group>
          )}
        </Table.Td>

        {/* Bought Column */}
        <Table.Td>
          {isEditing ? (
            <Checkbox
              checked={editedRow?.bought || false}
              disabled={saving}
              onChange={event =>
                updateEditedRow({ bought: event.currentTarget.checked })
              }
            />
          ) : (
            <Checkbox checked={row.bought} readOnly />
          )}
        </Table.Td>

        {/* Customer Column */}
        <Table.Td>
          {isEditing ? (
            <Stack gap="xs">
              <TextInput
                disabled={saving}
                error={validationErrors.customer}
                onChange={event =>
                  updateEditedRow({ customer: event.currentTarget.value })
                }
                placeholder="Enter customer name"
                value={editedRow?.customer || ""}
              />
            </Stack>
          ) : (
            <Text>{row.customer || <Text c="dimmed">No customer</Text>}</Text>
          )}
        </Table.Td>

        {/* Date Column */}
        <Table.Td>
          {isEditing ? (
            <Stack gap="xs">
              <DatePickerInput
                disabled={saving}
                error={validationErrors.date}
                onChange={value =>
                  updateEditedRow({ date: convertPickerOutputToString(value) })
                }
                placeholder="Select date"
                value={parseYMDStringToDate(editedRow?.date)}
              />
            </Stack>
          ) : (
            <Text>{row.date || <Text c="dimmed">No date</Text>}</Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack>
      <Group>
        <Button
          disabled={editingRowId !== null}
          leftSection={<IconPlus />}
          onClick={addRow}
        >
          Add Row
        </Button>
      </Group>

      {data.length === 0 ? (
        <Alert color="blue" title="No data available" variant="light">
          <Text>
            No records found. Click Add Row to create your first record.
          </Text>
        </Alert>
      ) : (
        <Table highlightOnHover striped withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Actions</Table.Th>
              <Table.Th>Bought</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}

      <Modal
        onClose={closeDeleteModal}
        opened={deleteModalOpen}
        title="Confirm Delete"
      >
        <Text mb="md">
          Are you sure you want to delete this record? This action cannot be
          undone.
        </Text>
        <Group>
          <Button color="red" onClick={confirmDelete}>
            Delete
          </Button>
          <Button onClick={closeDeleteModal} variant="default">
            Cancel
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
