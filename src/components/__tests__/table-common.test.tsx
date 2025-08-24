import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ActionButtons,
  CellRendererComponent,
  ColumnConfig,
  DeleteDialog,
  isPersistentId,
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "../table-common";

// --- Utility Functions ---

describe("isPersistentId", () => {
  it("should return true for numeric IDs", () => {
    expect(isPersistentId("123")).toBe(true);
  });

  it("should return false for IDs prefixed with 'new-'", () => {
    expect(isPersistentId("new-123")).toBe(false);
  });
});

// --- Component Tests ---

describe("ActionButtons", () => {
  const mockProperties = {
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onSave: vi.fn(),
  };

  describe("when not in editing mode", () => {
    it("should render Edit and Delete buttons for an existing record", () => {
      render(
        <ActionButtons
          {...mockProperties}
          isEditing={false}
          isExistingRecord={true}
          saving={false}
          validationErrors={{}}
        />
      );
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });
  });

  describe("when in editing mode", () => {
    it("should render Save and Cancel buttons", () => {
      render(
        <ActionButtons
          {...mockProperties}
          isEditing={true}
          isExistingRecord={true}
          saving={false}
          validationErrors={{}}
        />
      );
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("should disable the Save button when saving is in progress", () => {
      render(
        <ActionButtons
          {...mockProperties}
          isEditing={true}
          isExistingRecord={true}
          saving={true}
          validationErrors={{}}
        />
      );
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("should disable the Save button when there are validation errors", () => {
      render(
        <ActionButtons
          {...mockProperties}
          isEditing={true}
          isExistingRecord={true}
          saving={false}
          validationErrors={{ name: "This field is required" }}
        />
      );
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });
});

describe("CellRendererComponent", () => {
  // Helper component to test controlled inputs
  type ControlledInputWrapperProperties<T extends { id: string }> = {
    col: ColumnConfig<T>;
    initialValue: T[keyof T];
  };

  function ControlledInputWrapper<T extends { id: string }>({
    col,
    initialValue,
  }: ControlledInputWrapperProperties<T>) {
    const [value, setValue] = React.useState(initialValue);
    return (
      <CellRendererComponent<T>
        col={col}
        isEditing={true}
        saving={false}
        updateEditedRow={(_, newValue) => setValue(newValue)}
        value={value}
      />
    );
  }

  describe("Display Mode (isEditing = false)", () => {
    it("should render a simple string value", () => {
      render(
        <CellRendererComponent
          col={
            { key: "name", label: "Name" } as ColumnConfig<{
              id: string;
              name: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value="John Doe"
        />
      );
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should render a formatted date string", () => {
      render(
        <CellRendererComponent
          col={
            { key: "date", label: "Date", type: "date" } as ColumnConfig<{
              date: string;
              id: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value="2023-01-01"
        />
      );
      expect(screen.getByText("1/1/2023")).toBeInTheDocument();
    });

    it("should render 'Invalid Date' for a malformed date string", () => {
      render(
        <CellRendererComponent
          col={
            { key: "date", label: "Date", type: "date" } as ColumnConfig<{
              date: string;
              id: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value="not-a-date"
        />
      );
      expect(screen.getByText("Invalid Date")).toBeInTheDocument();
    });

    it("should render a number value", () => {
      render(
        <CellRendererComponent
          col={
            { key: "age", label: "Age", type: "number" } as ColumnConfig<{
              age: number;
              id: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value={30}
        />
      );
      expect(screen.getByText("30")).toBeInTheDocument();
    });
    it("should render a date value", () => {
      render(
        <CellRendererComponent
          col={
            { key: "date", label: "Date", type: "date" } as ColumnConfig<{
              date: string;
              id: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value="2023-01-01"
        />
      );
      expect(screen.getByText("1/1/2023")).toBeInTheDocument();
    });
    it("should render date value with time", () => {
      render(
        <CellRendererComponent
          col={
            { key: "date", label: "Date", type: "date" } as ColumnConfig<{
              date: Date;
              id: string;
            }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value={new Date("2023-01-01T12:00:00Z")}
        />
      );
      expect(screen.getByText("1/1/2023")).toBeInTheDocument();
    });

    it("should render a disabled checkbox for a boolean value", () => {
      render(
        <CellRendererComponent
          col={
            {
              key: "isActive",
              label: "Active",
              type: "checkbox",
            } as ColumnConfig<{ id: string; isActive: boolean }>
          }
          isEditing={false}
          saving={false}
          updateEditedRow={vi.fn()}
          value={true}
        />
      );
      const checkbox = screen.getByLabelText("Active");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });
  });

  describe("Editing Mode (isEditing = true)", () => {
    it("should render a text input", () => {
      render(
        <CellRendererComponent
          col={
            { key: "name", label: "Name", type: "text" } as ColumnConfig<{
              id: string;
              name: string;
            }>
          }
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value="John Doe"
        />
      );
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    it("should render a number input", () => {
      render(
        <CellRendererComponent
          col={
            { key: "age", label: "Age", type: "number" } as ColumnConfig<{
              age: number;
              id: string;
            }>
          }
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value={30}
        />
      );
      expect(screen.getByLabelText("Age")).toBeInTheDocument();
    });

    it("should render an interactive checkbox", () => {
      render(
        <CellRendererComponent
          col={
            {
              key: "isActive",
              label: "Active",
              type: "checkbox",
            } as ColumnConfig<{ id: string; isActive: boolean }>
          }
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value={true}
        />
      );
      const checkbox = screen.getByLabelText("Active");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeDisabled();
    });
    it("should render an interactive checkbox with error", () => {
      render(
        <CellRendererComponent
          col={
            {
              key: "isActive",
              label: "Active",
              type: "checkbox",
            } as ColumnConfig<{ id: string; isActive: boolean }>
          }
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value={true}
        />
      );
      const checkbox = screen.getByLabelText("Active");
      expect(checkbox).toHaveAttribute("aria-describedby", "isActive-error");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeDisabled();
    });

    it("should render a select dropdown", () => {
      render(
        <CellRendererComponent
          col={
            {
              key: "status",
              label: "Status",
              options: [{ label: "Active", value: "active" }],
              type: "select",
            } as ColumnConfig<{ id: string; status: string }>
          }
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value="active"
        />
      );
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
    it("should render a select dropdown with error", () => {
      render(
        <CellRendererComponent
          col={
            {
              key: "status",
              label: "Status",
              options: [{ label: "Active", value: "active" }],
              type: "select",
            } as ColumnConfig<{ id: string; status: string }>
          }
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value="active"
        />
      );
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveAttribute(
        "aria-describedby",
        "status-error"
      );
    });

    it("should render a date input", () => {
      render(
        <CellRendererComponent
          col={
            { key: "date", label: "Date", type: "date" } as ColumnConfig<{
              date: string;
              id: string;
            }>
          }
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value="2023-01-01"
        />
      );
      expect(screen.getByLabelText("Date")).toBeInTheDocument();
    });

    it("should apply error styles and aria attributes when an error message is present", () => {
      render(
        <CellRendererComponent
          col={
            { key: "name", label: "Name", type: "text" } as ColumnConfig<{
              id: string;
              name: string;
            }>
          }
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={vi.fn()}
          value="John Doe"
        />
      );
      const input = screen.getByLabelText("Name");
      expect(input).toHaveClass("border-destructive");
      expect(input).toHaveAttribute("aria-describedby", "name-error");
    });
  });

  describe("Event Handlers", () => {
    it("should call updateEditedRow when text input value changes", async () => {
      const user = userEvent.setup();
      render(
        <ControlledInputWrapper<{ id: string; name: string }>
          col={{ key: "name", label: "Name", type: "text" }}
          initialValue="John"
        />
      );
      const input = screen.getByLabelText("Name");
      await user.clear(input);
      await user.type(input, "Jane");
      expect(input).toHaveValue("Jane");
    });

    it("should call updateEditedRow when number input value changes", async () => {
      const user = userEvent.setup();
      render(
        <ControlledInputWrapper<{ age: number; id: string }>
          col={{ key: "age", label: "Age", type: "number" }}
          initialValue={30}
        />
      );
      const input = screen.getByLabelText("Age");
      await user.clear(input);
      await user.type(input, "45");
      expect(input).toHaveValue(45);
    });
    it("should call updateEditedRow when date input value changes", async () => {
      const user = userEvent.setup();
      render(
        <ControlledInputWrapper<{ date: string; id: string }>
          col={{ key: "date", label: "Date", type: "date" }}
          initialValue="2023-01-01"
        />
      );
      const input = screen.getByLabelText("Date");
      await user.clear(input);
      await user.type(input, "2023-01-02");
      expect(input).toHaveValue("2023-01-02");
    });

    it("should call updateEditedRow when checkbox is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ControlledInputWrapper<{ id: string; isActive: boolean }>
          col={{ key: "isActive", label: "Active", type: "checkbox" }}
          initialValue={false}
        />
      );
      const checkbox = screen.getByLabelText("Active");
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it("should call updateEditedRow with the correct value when a select option is chosen", async () => {
      const user = userEvent.setup();
      const colConfig: ColumnConfig<{ id: string; status: string }> = {
        key: "status",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
        type: "select",
      };

      const mockUpdateEditedRow = vi.fn();

      render(
        <CellRendererComponent<{ id: string; status: string }>
          col={colConfig}
          isEditing={true}
          saving={false}
          updateEditedRow={mockUpdateEditedRow}
          value="active"
        />
      );

      // Open the select dropdown by clicking the trigger
      const selectTrigger = screen.getByRole("combobox");
      await user.click(selectTrigger);

      // Select the "Inactive" option
      const inactiveOption = await screen.findByText("Inactive");
      await user.click(inactiveOption);

      expect(mockUpdateEditedRow).toHaveBeenCalledWith("status", "inactive");
      expect(mockUpdateEditedRow).toHaveBeenCalledTimes(1);
    });
  });
});

describe("DeleteDialog", () => {
  const mockProperties = {
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("should render the confirmation message when open", () => {
    render(<DeleteDialog {...mockProperties} open={true} />);
    expect(
      screen.getByText(/this action cannot be undone/i)
    ).toBeInTheDocument();
  });

  it("should display a loading state and disable buttons when deleting", () => {
    render(<DeleteDialog {...mockProperties} isDeleting={true} open={true} />);
    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("should call onConfirm when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    render(
      <DeleteDialog {...mockProperties} onConfirm={handleConfirm} open={true} />
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Table States", () => {
  describe("TableEmptyState", () => {
    it("should render the default empty state message", () => {
      render(<TableEmptyState />);
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("should render a custom action when provided", () => {
      render(<TableEmptyState action={<button>Add Item</button>} />);
      expect(
        screen.getByRole("button", { name: /add item/i })
      ).toBeInTheDocument();
    });
  });

  describe("TableErrorState", () => {
    it("should render a generic error message if error is not an Error instance", () => {
      render(<TableErrorState error={undefined} />);
      expect(screen.getByText("An unknown error occurred")).toBeInTheDocument();
    });

    it("should render the error message from the error object", () => {
      render(<TableErrorState error={new Error("Failed to fetch")} />);
      expect(screen.getByText("Error loading data")).toBeInTheDocument();
    });

    it("should call the retry function when the retry button is clicked", async () => {
      const user = userEvent.setup();
      const retryMock = vi.fn();
      render(
        <TableErrorState error={new Error("Network Error")} retry={retryMock} />
      );
      await user.click(screen.getByRole("button", { name: /retry/i }));
      expect(retryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("TableLoadingState", () => {
    it("should render the loading message", () => {
      render(<TableLoadingState />);
      expect(screen.getByText("Loading data...")).toBeInTheDocument();
    });
  });
});
