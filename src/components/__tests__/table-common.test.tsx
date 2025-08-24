import { fireEvent, render } from "@testing-library/react";
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
it("checks if id is persistent", () => {
  expect(isPersistentId("123")).toBe(true);
  expect(isPersistentId("new-123")).toBe(false);
});
describe("actionButtons", () => {
  it("action buttons are rendered", () => {
    const { getByRole } = render(
      <ActionButtons
        isEditing={false}
        isExistingRecord={true}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        validationErrors={{}}
      />
    );
    expect(getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("action buttons with is editing", () => {
    const { getByRole } = render(
      <ActionButtons
        isEditing={true}
        isExistingRecord={true}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        validationErrors={{}}
      />
    );
    expect(getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
  it("action buttons with is editing and saving", () => {
    const { getByRole } = render(
      <ActionButtons
        isEditing={true}
        isExistingRecord={true}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        saving={true}
        validationErrors={{}}
      />
    );
    expect(getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
  it("action buttons with validation errors", () => {
    const { getByRole } = render(
      <ActionButtons
        isEditing={true}
        isExistingRecord={true}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        validationErrors={{ ERROR: "This field is required" }}
      />
    );
    expect(getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
describe("cellRenderer", () => {
  it("cell render component", () => {
    const { getByText } = render(
      <CellRendererComponent<{ id: number; name: string }>
        col={{ key: "name", label: "Name" }}
        errorMessage={undefined}
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value="John Doe"
      />
    );
    expect(getByText("John Doe")).toBeInTheDocument();
  });
  it("cell render component with date value", () => {
    const { getByText } = render(
      <CellRendererComponent
        col={{ key: "id", label: "date", type: "date" }}
        errorMessage="This field is required"
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value="2023-01-01"
      />
    );
    expect(
      getByText(content => content.includes("1/1/2023"))
    ).toBeInTheDocument();
  });
  it("cell render component with invalid date value", () => {
    const { getByText } = render(
      <CellRendererComponent
        col={{ key: "id", label: "date", type: "date" }}
        errorMessage="This field is required"
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value="this is not a date"
      />
    );
    expect(
      getByText(content => content.includes("Invalid Date"))
    ).toBeInTheDocument();
  });
  it("cell render component with date and time value", () => {
    const { getByText } = render(
      <CellRendererComponent
        col={{ key: "id", label: "date", type: "date" }}
        errorMessage="This field is required"
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value={new Date("2023-01-01T12:00:00Z")}
      />
    );
    expect(getByText("1/1/2023")).toBeInTheDocument();
  });
  it("cell value with number", () => {
    const { getByText } = render(
      <CellRendererComponent<{ age: number; id: number }>
        col={{ key: "age", label: "Age", type: "number" }}
        errorMessage="This field is required"
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value={30}
      />
    );
    expect(getByText("30")).toBeInTheDocument();
  });
  it("cell value with boolean", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; isActive: boolean }>
        col={{ key: "isActive", label: "Active", type: "checkbox" }}
        isEditing={false}
        saving={false}
        updateEditedRow={vi.fn()}
        value={true}
      />
    );
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });
  it("");

  it("cell value with boolean and editing", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; isActive: boolean }>
        col={{ key: "isActive", label: "Active", type: "checkbox" }}
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value={true}
      />
    );
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });
  it("cell value with boolean and error", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; isActive: boolean }>
        col={{ key: "isActive", label: "Active", type: "checkbox" }}
        errorMessage="This field is required"
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value={true}
      />
    );
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
    const value = screen.getAllByRole("checkbox");
    expect(value[0]).toHaveAttribute("aria-describedby", "isActive-error");
  });
  it("cell value with select", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; status: string }>
        col={{
          key: "status",
          label: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
          type: "select",
        }}
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value="active"
      />
    );
    const value = screen.getAllByRole("combobox");
    expect(value[0]).toBeInTheDocument();
  });
  it("cell value with select and error", () => {
    const screen = render(
      <CellRendererComponent<{ date: Date; id: number }>
        col={{ key: "date", label: "Date", type: "date" }}
        errorMessage="This field is required"
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value={new Date("2023-01-01")}
      />
    );
    const value = screen.getByLabelText("Date");
    expect(value).toBeInTheDocument();
    expect(value).toHaveAttribute("aria-describedby", "date-error");
  });
  it("cell value with number", () => {
    const screen = render(
      <CellRendererComponent<{ age: number; id: number }>
        col={{ key: "age", label: "Age", type: "number" }}
        errorMessage="This field is required"
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value={30}
      />
    );
    const value = screen.getByLabelText("Age");
    expect(value).toBeInTheDocument();
    expect(value).toHaveAttribute("aria-describedby", "age-error");
  });
  it("cell value with text", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; name: string }>
        col={{ key: "id", label: "Name", type: "text" }}
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value="John Doe"
      />
    );
    const value = screen.getByLabelText("Name");
    expect(value).toBeInTheDocument();
  });
  it("cell value with error", () => {
    const screen = render(
      <CellRendererComponent<{ id: number; name: string }>
        col={{ key: "name", label: "Name", type: "text" }}
        errorMessage="This field is required"
        isEditing={true}
        saving={false}
        updateEditedRow={vi.fn()}
        value="John Doe"
      />
    );
    const value = screen.getByLabelText("Name");
    expect(value).toBeInTheDocument();
    expect(value).toHaveAttribute("aria-describedby", "name-error");
    expect(value).toHaveClass("border-destructive");
  });
  it("cell renderer handle input change", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState("John Doe");
      return (
        <CellRendererComponent
          col={{ key: "id", label: "Name", type: "text" }}
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "Jane Doe" } });
    expect(input).toHaveValue("Jane Doe");
  });
  it("cell renderer handle input change with date", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState("2023-01-01");
      return (
        <CellRendererComponent<{ date: string; id: number }>
          col={{ key: "date", label: "Date", type: "date" }}
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "2023-01-02" } });
    expect(input).toHaveValue("2023-01-02");
  });
  it("cell renderer handle input change with number", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState("123");
      type RowType = { age: string; id: number };
      return (
        <CellRendererComponent<RowType>
          col={{ key: "age", label: "Age", type: "number" }}
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    const input = screen.getByLabelText("Age");
    fireEvent.change(input, { target: { value: "456" } });
    expect(input).toHaveValue(456);
  });
  it("handle checkbox change", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState(false);
      return (
        <CellRendererComponent
          col={{ key: "id", label: "Active", type: "checkbox" }}
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(Boolean(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    const checkbox = screen.getByLabelText("Active");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
  it("handle select change", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState("option1");
      type RowType = { id: number; status: string };
      return (
        <CellRendererComponent<RowType>
          col={{
            key: "status",
            label: "Select",
            options: [
              { label: "Option 1", value: "option1" },
              { label: "Option 2", value: "option2" },
            ],
            type: "select",
          }}
          errorMessage="This field is required"
          isEditing={true}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "option2" } });
    expect(select).toHaveValue("option2");
  });
  it("render normal value", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState("Normal Value");
      type RowType = { id: number; status: string };
      return (
        <CellRendererComponent<RowType>
          col={{ key: "status", label: "Status", type: "text" }}
          errorMessage="This field is required"
          isEditing={false}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    expect(screen.getByText("Normal Value")).toBeInTheDocument();
  });
  it("render null value", () => {
    // Simulate controlled value with React state
    function Wrapper() {
      const [value, setValue] = React.useState<null | string>(null);
      type RowType = { id: number; status: string };
      return (
        <CellRendererComponent<RowType>
          col={{ key: "status", label: "Status", type: "text" }}
          errorMessage="This field is required"
          isEditing={false}
          saving={false}
          updateEditedRow={(_, newValue) => setValue(String(newValue))}
          value={value}
        />
      );
    }
    const screen = render(<Wrapper />);
    expect(screen.getByText("null")).toHaveClass("text-muted-foreground");
  });

  it("handleSelectChange calls updateEditedRow with correct parameters", () => {
    const updateEditedRowMock = vi.fn();
    type RowType = { id: number; status: string };
    const col: ColumnConfig<RowType> = {
      key: "status",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      type: "select",
    };

    const screen = render(
      <CellRendererComponent<RowType>
        col={col}
        isEditing={true}
        saving={false}
        updateEditedRow={updateEditedRowMock}
        value="active"
      />
    );

    // Find the Select component and trigger onValueChange directly
    // Since Radix UI Select uses a different mechanism, we can test the handler directly
    // by accessing the component's props or using a different approach

    // Alternative: Test the select by opening it and clicking an option
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // Now find and click the option
    const option = screen.getByText("Inactive");
    fireEvent.click(option);

    // Verify that updateEditedRow was called with the correct parameters
    expect(updateEditedRowMock).toHaveBeenCalledWith("status", "inactive");
    expect(updateEditedRowMock).toHaveBeenCalledTimes(1);
  });
});
describe("deleteDialog", () => {
  it("renders delete confirmation dialog", () => {
    const screen = render(
      <DeleteDialog onClose={vi.fn()} onConfirm={vi.fn()} open={true} />
    );
    expect(
      screen.getByText(
        "This action cannot be undone. Are you sure you want to delete this record?"
      )
    ).toBeInTheDocument();
  });
  it("renders delete with isDeleting prop", () => {
    const screen = render(
      <DeleteDialog
        isDeleting={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
      />
    );
    expect(screen.getByText("Deleting...")).toBeInTheDocument();
  });
  it("render delete with handle confirm", () => {
    const handleConfirm = vi.fn();
    const screen = render(
      <DeleteDialog
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        open={true}
      />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(handleConfirm).toHaveBeenCalled();
  });
});
describe("TableEmptyState", () => {
  it("renders empty state message", () => {
    const screen = render(<TableEmptyState />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
  it("renders empty state with actions", () => {
    const screen = render(<TableEmptyState action={<button>Retry</button>} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
describe("tableErrorState", () => {
  it("renders error state message", () => {
    const screen = render(<TableErrorState error={new Error("Test error")} />);
    expect(screen.getByText("Error loading data")).toBeInTheDocument();
  });
  it("renders error state with actions", () => {
    const retryMock = vi.fn();
    const screen = render(
      <TableErrorState error={new Error("Test error")} retry={retryMock} />
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
  it("render error with non error state", () => {
    const screen = render(<TableErrorState error={null} />);
    expect(screen.getByText("An unknown error occurred")).toBeInTheDocument();
  });
});
it("tableLoadingState", () => {
  const screen = render(<TableLoadingState />);
  expect(screen.getByText("Loading data...")).toBeInTheDocument();
});
