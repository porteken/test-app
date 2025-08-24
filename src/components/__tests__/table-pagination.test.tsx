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
  return { ...actual };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const setup = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

const ResizeObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

type MockApiResponse = {
  data: MockDataRow[] | string[];
  page: number;
  pageSize: number;
  total: number;
};

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

const mockFetchResponse = (response: any, ok = true): Response =>
  ({
    json: () => Promise.resolve(response),
    ok,
  } as Response);

describe("TablePagination", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it("displays loading state initially", () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("renders filter controls and applies filters", async () => {
    const mockData: MockApiResponse = {
      data: [
        { id: 1, user_name: "John_Doe" },
        { id: 2, user_name: "Jane_Smith" },
      ],
      page: 1,
      pageSize: 10,
      total: 2,
    };
    const mockFilters: MockApiResponse = {
      data: ["Jimmy_Nutron", "Jane_Smith"],
      page: 1,
      pageSize: 10,
      total: 2,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const path = new URL(url.toString()).pathname;
      if (path === MOCK_API_CONFIG.endpoints.data)
        return Promise.resolve(mockFetchResponse(mockData));
      if (path === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse(mockFilters));
      return Promise.reject(new Error(`Unhandled fetch: ${path}`));
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

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await waitFor(() =>
      expect(screen.getByText("Jimmy_Nutron")).toBeInTheDocument()
    );

    await user.click(screen.getByText("Jimmy_Nutron"));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("user_name=Jimmy_Nutron")
      )
    );

    await user.click(screen.getByLabelText("Clear all filters"));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1")
    );
  });

  it("renders empty table when API returns no data", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse({ data: [], page: 1, pageSize: 10, total: 0 })
    );

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("No data available")).toBeInTheDocument()
    );
  });

  it("renders a table with data and pagination controls", async () => {
    const mockResponse: MockApiResponse = {
      data: [
        { id: 1, user_name: "John Doe" },
        { id: 2, user_name: "Jane Smith" },
      ],
      page: 1,
      pageSize: 50,
      total: 100,
    };

    vi.mocked(globalThis.fetch).mockImplementation(url => {
      const path = new URL(url.toString()).pathname;
      if (path === MOCK_API_CONFIG.endpoints.data)
        return Promise.resolve(mockFetchResponse(mockResponse));
      if (path === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse({ data: [] }));
      return Promise.reject(new Error(`Unhandled fetch: ${path}`));
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

  it("handles 2 pages navigation", async () => {
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
      const { pathname, searchParams } = new URL(url.toString());
      if (pathname === MOCK_API_CONFIG.endpoints.data) {
        return searchParams.get("page") === "2"
          ? Promise.resolve(mockFetchResponse(mockResponsePage2))
          : Promise.resolve(mockFetchResponse(mockResponsePage1));
      }
      if (pathname === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse({ data: [] }));
      return Promise.reject(new Error(`Unhandled fetch: ${pathname}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    await user.click(screen.getByLabelText("Go to next page"));

    await waitFor(() =>
      expect(screen.getByText("Jane Smith")).toBeInTheDocument()
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Go to previous page")).toHaveAttribute(
        "aria-disabled",
        "false"
      );
      expect(screen.getByLabelText("Go to next page")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });
    await user.click(screen.getByLabelText("Go to previous page"));
    await waitFor(() => {
      expect(screen.getByLabelText("Go to previous page")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
      expect(screen.getByLabelText("Go to next page")).toHaveAttribute(
        "aria-disabled",
        "false"
      );
    });
  });

  it("handles 2nd out of 3 pages", async () => {
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
      const path = new URL(url.toString()).pathname;
      if (path === MOCK_API_CONFIG.endpoints.data)
        return Promise.resolve(mockFetchResponse(mockResponse));
      if (path === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse({ data: [] }));
      return Promise.reject(new Error(`Unhandled fetch: ${path}`));
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
    await user.click(screen.getByLabelText("Go to next page"));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2")
      )
    );
  });

  it("handles clicking a page number", async () => {
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
      const { pathname, searchParams } = new URL(url.toString());
      if (pathname === MOCK_API_CONFIG.endpoints.data) {
        return searchParams.get("page") === "2"
          ? Promise.resolve(mockFetchResponse(mockResponsePage2))
          : Promise.resolve(mockFetchResponse(mockResponsePage1));
      }
      if (pathname === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse({ data: [] }));
      return Promise.reject(new Error(`Unhandled fetch: ${pathname}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.click(screen.getByText("2"));

    await waitFor(() =>
      expect(screen.getByText("Jane Smith")).toBeInTheDocument()
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2")
    );
  });

  it("handles delete flow", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const { pathname } = new URL(url.toString(), "http://localhost");
      if (
        pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      )
        return Promise.resolve(mockFetchResponse(mockResponse));
      if (
        pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      )
        return Promise.resolve(mockFetchResponse({}, true));
      if (pathname === MOCK_API_CONFIG.endpoints.filters)
        return Promise.resolve(mockFetchResponse({ data: [] }));
      return Promise.reject(new Error(`Unhandled API call: ${pathname}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open menu"));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByLabelText("Confirm delete"));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/1`,
        { method: "DELETE" }
      )
    );
  });

  it("handles delete cancel", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(mockResponse)
    );

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open menu"));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByLabelText("Cancel delete"));

    await waitFor(() =>
      expect(screen.queryByLabelText("Cancel delete")).not.toBeInTheDocument()
    );
  });

  it("handles delete error", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 1,
    };

    vi.mocked(globalThis.fetch).mockImplementation((url, options) => {
      const { pathname } = new URL(url.toString(), "http://localhost");
      if (
        pathname === MOCK_API_CONFIG.endpoints.data &&
        options?.method !== "DELETE"
      )
        return Promise.resolve(mockFetchResponse(mockResponse));
      if (
        pathname.startsWith(MOCK_API_CONFIG.endpoints.delete) &&
        options?.method === "DELETE"
      )
        return Promise.resolve(mockFetchResponse({}, false));
      return Promise.reject(new Error(`Unhandled API call: ${pathname}`));
    });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open menu"));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByLabelText("Confirm delete"));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/1`,
        { method: "DELETE" }
      )
    );
  });
});

describe("generatePaginationRange", () => {
  it("generates correct pagination ranges", () => {
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
  });

  it("fetches table data with filters", async () => {
    const mockResponse = {
      data: [{ id: 1, user_name: "John Doe" }],
      page: 1,
      pageSize: 50,
      total: 150,
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(mockResponse)
    );

    const result = await fetchTableData(
      { search: "John" },
      1,
      50,
      MOCK_API_CONFIG
    );
    expect(result).toEqual({
      data: mockResponse.data,
      hasMore: false,
      total: 150,
    });
  });

  it("throws on fetch error", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      statusText: "error",
    } as Response);
    await expect(
      fetchTableData({ search: "John" }, 1, 50, MOCK_API_CONFIG)
    ).rejects.toThrow("error");
  });
});

describe("tanstack query", () => {
  it("renders error state", async () => {
    const actual = await import("@tanstack/react-query");
    actual.useQuery = vi.fn().mockReturnValue({ isError: true });

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    expect(screen.getByText("An unknown error occurred")).toBeInTheDocument();
  });
});
