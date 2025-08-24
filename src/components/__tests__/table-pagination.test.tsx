import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchTableData,
  generatePaginationRange,
  TablePagination,
} from "../table-pagination";
vi.mock("@tanstack/react-query", async () => {
  const actual = await import("@tanstack/react-query");
  return {
    ...actual, // Return all the original exports
  };
});
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

type MockApiResponse = {
  data: MockDataRow[] | string[];
  page: number;
  pageSize: number;
  total: number;
};
// --- Mock Data Structure ---
type MockDataRow = { id: number; user_name?: string };

const MOCK_API_CONFIG = {
  baseUrl: "http://localhost:3000",
  endpoints: {
    data: "/api/data",
    delete: "/api/data",
    filters: "/api/data/filters",
  },
};

const MOCK_COLUMN_CONFIGS = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "user_name", header: "User Name" },
];

const setup = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};
const ResizeObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

// Stub the global ResizeObserver
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// --- Test Suite ---
describe("TablePagination", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it("should display a loading state initially", () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("should render filter controls when filterConfigs are provided", async () => {
    const mockDataResponse: MockApiResponse = {
      data: [
        { id: 1, user_name: "John_Doe" },
        { id: 2, user_name: "Jane_Smith" },
      ],
      page: 3,
      pageSize: 50,
      total: 150,
    };
    const mockFilterResponse: MockApiResponse = {
      data: ["Jimmy_Nutron", "Jane_Smith"],
      page: 1,
      pageSize: 50,
      total: 2,
    };
    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlPath = new URL(url.toString()).pathname;
      if (urlPath === MOCK_API_CONFIG.endpoints.data) {
        return Promise.resolve({
          json: () => Promise.resolve(mockDataResponse),
          ok: true,
        } as Response);
      }
      if (urlPath === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve(mockFilterResponse),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${urlPath}`));
    });
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        filterConfigs={[
          {
            apiField: "user_name",
            key: "user_name",
            label: "User",
            placeholder: "Select User",
          },
        ]}
        pageSize={10}
      />
    );
    expect(screen.getByText("Select User")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    const user = userEvent.setup();
    const select = screen.getByRole("combobox");
    await user.click(select);
    await waitFor(() => {
      expect(screen.getByText("Jimmy_Nutron")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Jimmy_Nutron"));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("user_name=Jimmy_Nutron")
      );
    });
    await user.click(screen.getByLabelText("Clear all filters"));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1")
    );
  });

  it("should render an empty table when the API returns no data", async () => {
    const emptyResponse: MockApiResponse = {
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
    };

    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve(emptyResponse),
        ok: true,
      } as Response)
    );

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  it("should render a table with data and pagination controls", async () => {
    const mockResponse: MockApiResponse = {
      data: [
        { id: 1, user_name: "John Doe" },
        { id: 2, user_name: "Jane Smith" },
      ],
      page: 1,
      pageSize: 50,
      total: 100, // Total items
    };

    // This more robust mock handles different endpoints if needed
    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlPath = new URL(url.toString()).pathname;
      if (urlPath === MOCK_API_CONFIG.endpoints.data) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (urlPath === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }), // Mock empty filters
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${urlPath}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
    const previousButton = screen.getByLabelText("Go to previous page");
    expect(previousButton).toHaveClass("pointer-events-none opacity-50");
    const user = userEvent.setup();
    await user.click(previousButton);

    expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
  });
  it("should handle 2 pages", async () => {
    const user = userEvent.setup();
    const mockResponsePage1 = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 10,
      total: 20,
    };
    const mockResponsePage2 = {
      data: [{ id: 2, user_name: "Jane Smith" }],
      page: 2,
      pageSize: 10,
      total: 20,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlObject = new URL(url.toString());
      const page = urlObject.searchParams.get("page") || "1";
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.data) {
        if (page === "2") {
          return Promise.resolve({
            json: () => Promise.resolve(mockResponsePage2),
            ok: true,
          } as Response);
        }
        return Promise.resolve({
          json: () => Promise.resolve(mockResponsePage1),
          ok: true,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(
        new Error(`Unhandled API call to ${urlObject.pathname}`)
      );
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText("Go to next page");
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    const previousButton = screen.getByLabelText("Go to previous page");
    await waitFor(() => {
      expect(previousButton).toHaveAttribute("aria-disabled", "false");
      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).toHaveAttribute("aria-disabled", "true");
    });
    await user.click(previousButton);
  });
  it("should handle 2nd out of 3rd page", async () => {
    const mockResponse: MockApiResponse = {
      data: [
        { id: 1, user_name: "John Doe" },
        { id: 2, user_name: "Jane Smith" },
      ],
      page: 3,
      pageSize: 50,
      total: 150,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlPath = new URL(url.toString()).pathname;
      if (urlPath === MOCK_API_CONFIG.endpoints.data) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (urlPath === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${urlPath}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const nextButton = screen.getByLabelText("Go to next page");
    await user.click(nextButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2")
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });
    expect(nextButton).not.toHaveClass("pointer-events-none opacity-50");
  });
  it("should handle clicking x page button", async () => {
    const mockResponsePage1 = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 10,
      total: 150,
    };
    const mockResponsePage2 = {
      data: [{ id: 2, user_name: "Jane Smith" }],
      page: 2,
      pageSize: 10,
      total: 150,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlObject = new URL(url.toString());
      const page = urlObject.searchParams.get("page") || "1";
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.data) {
        if (page === "2") {
          return Promise.resolve({
            json: () => Promise.resolve(mockResponsePage2),
            ok: true,
          } as Response);
        }
        return Promise.resolve({
          json: () => Promise.resolve(mockResponsePage1),
          ok: true,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(
        new Error(`Unhandled API call to ${urlObject.pathname}`)
      );
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const page2Button = screen.getByText("2");
    await user.click(page2Button);

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2")
      );
    });
  });
  it("should handle Delete", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const urlObject = new URL(url.toString(), "http://localhost");
      if (
        urlObject.pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (
        urlObject.pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve({}), // Empty successful response
          ok: true,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${url}`));
    });

    const user = userEvent.setup();
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete={true}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Open menu"));

    const deleteButton = await screen.findByText("Delete");
    await user.click(deleteButton);

    const confirmButton = await screen.findByLabelText("Confirm delete");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/1`,
        { method: "DELETE" }
      );
    });
  });
  it("should handle Delete with close", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const urlObject = new URL(url.toString(), "http://localhost");
      if (
        urlObject.pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (
        urlObject.pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve({}), // Empty successful response
          ok: true,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${url}`));
    });

    const user = userEvent.setup();
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete={true}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Open menu"));

    const deleteButton = await screen.findByText("Delete");
    await user.click(deleteButton);

    const confirmButton = await screen.findByLabelText("Cancel delete");
    await user.click(confirmButton);

    await waitFor(async () => {
      await waitFor(() => {
        expect(
          screen.queryByLabelText("Cancel delete")
        ).not.toBeInTheDocument();
      });
    });
  });
  it("should handle Delete with error", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const urlObject = new URL(url.toString(), "http://localhost");
      if (
        urlObject.pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (
        urlObject.pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve({}), // Empty successful response
          ok: false,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${url}`));
    });

    const user = userEvent.setup();
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete={true}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Open menu"));

    const deleteButton = await screen.findByText("Delete");
    await user.click(deleteButton);

    const confirmButton = await screen.findByLabelText("Confirm delete");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/1`,
        { method: "DELETE" }
      );
    });
    expect(globalThis.fetch).toThrowError();
  });
  it("should handle Delete with missing endpoint", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const urlObject = new URL(url.toString(), "http://localhost");
      if (
        urlObject.pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      if (
        urlObject.pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      ) {
        return Promise.resolve({
          json: () => Promise.resolve({}), // Empty successful response
          ok: false,
        } as Response);
      }
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.filters) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [] }),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${url}`));
    });

    const user = userEvent.setup();
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete={true}
        pageSize={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Open menu"));

    const deleteButton = await screen.findByText("Delete");
    await user.click(deleteButton);

    const confirmButton = await screen.findByLabelText("Confirm delete");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/1`,
        { method: "DELETE" }
      );
    });
    expect(globalThis.fetch).toThrowError();
  });
});
describe("generatePaginationRange", () => {
  it("should generate correct pagination range for various scenarios", () => {
    expect(generatePaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);

    expect(generatePaginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, "...", 10]);

    expect(generatePaginationRange(5, 10)).toEqual([
      1,
      "...",
      4,
      5,
      6,
      "...",
      10,
    ]);

    expect(generatePaginationRange(8, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });
});
describe("fetchTableData", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });
  it("should fetch table data with api filters", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 150,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const urlObject = new URL(url.toString(), "http://localhost");
      if (urlObject.pathname === MOCK_API_CONFIG.endpoints.data) {
        return Promise.resolve({
          json: () => Promise.resolve(mockResponse),
          ok: true,
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled API call to ${url}`));
    });

    const result = await fetchTableData(
      { search: "John" },
      1,
      50,
      MOCK_API_CONFIG
    );

    expect(result).toEqual({
      data: [{ id: 1, user_name: "John Doe" }],
      hasMore: false,
      total: 150,
    });
  });
  it("should handle fetch error", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 150,
    };
    vi.mocked(globalThis.fetch).mockImplementation(() => {
      return Promise.resolve({
        json: () => Promise.resolve(mockResponse),
        ok: false,
        statusText: "error",
      } as Response);
    });

    await expect(
      fetchTableData({ search: "John" }, 1, 50, MOCK_API_CONFIG)
    ).rejects.toThrow("error");
  });
});
describe("tanstack query", () => {
  it("should render error state", async () => {
    const actual = await import("@tanstack/react-query");
    actual.useQuery = vi.fn().mockReturnValue({
      isError: true,
    });
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete={true}
        pageSize={10}
      />
    );

    expect(screen.getByText("An unknown error occurred")).toBeInTheDocument();
  });
});
