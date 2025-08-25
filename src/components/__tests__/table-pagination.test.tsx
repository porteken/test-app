import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import React from "react";
import { mockIsIntersecting } from "react-intersection-observer/test-utils";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  type ApiResponse,
  fetchTableData,
  generatePaginationRange,
  TablePagination,
} from "../table-pagination";

// MSW Server Setup
// =================================================================

const MOCK_API_CONFIG = {
  baseUrl: "http://localhost:3000",
  endpoints: {
    data: "/api/data",
    delete: "/api/data",
    filters: "/api/filters",
  },
};

const mockFiltersPage1: ApiResponse<string> = {
  data: [
    "Jimmy_Nutron",
    "Jane_Smith",
    "John_Doe",
    "Lisa_Simpson",
    "Bart_Simpson",
    "Marge_Simpson",
    "Homer_Simpson",
    "Maggie_Simpson",
    "Greg_Johnson",
    "Peter_Jones",
  ],
  limit: 10,
  next: `${MOCK_API_CONFIG.endpoints.filters}?page=2`,
  page: 1,
  total: 14,
};
const mockFiltersPage2: ApiResponse<string> = {
  data: ["Tom_Never", "Frank_Stein", "Joe_Porter", "Steve_Williams"],
  limit: 10,
  page: 2,
  total: 14,
};
const mockProductFilters: ApiResponse<string> = {
  data: ["Product_A", "Product_B", "Product_C", "Product_D", "Product_E"],
  limit: 10,
  page: 1,
  total: 5,
};

// --- Define MSW Handlers ---
export const handlers = [
  // Handles GET requests for table data
  http.get(
    `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
    ({ request }) => {
      const url = new URL(request.url);
      const page = url.searchParams.get("page") || "1";
      const userName = url.searchParams.get("user_name");

      if (userName) {
        return HttpResponse.json({
          data: [{ id: 14, user_name: userName }],
          limit: 10,
          page: 1,
          total: 1,
        });
      }

      if (page === "2") {
        return HttpResponse.json({
          data: [{ id: 2, user_name: "Jane Smith" }],
          limit: 10,
          page: 2,
          total: 80,
        });
      }
      if (page === "5") {
        return HttpResponse.json({
          data: [{ id: 5, user_name: "Alice Johnson" }],
          limit: 10,
          page: 5,
          total: 80,
        });
      }
      if (page === "8") {
        return HttpResponse.json({
          data: [{ id: 8, user_name: "Bob Brown" }],
          limit: 10,
          page: 8,
          total: 80,
        });
      }

      return HttpResponse.json({
        data: [{ id: 1, user_name: "John Doe" }],
        limit: 10,
        page: 1,
        total: 80,
      });
    }
  ),

  // Handles GET requests for filter options
  http.get(
    `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.filters}`,
    ({ request }) => {
      const url = new URL(request.url);
      const page = url.searchParams.get("page") || "1";
      const field = url.searchParams.get("field");

      if (field === "product_name") {
        return HttpResponse.json(mockProductFilters);
      }

      // Default to user_name filter
      if (page === "2") {
        return HttpResponse.json(mockFiltersPage2);
      }
      return HttpResponse.json(mockFiltersPage1);
    }
  ),

  // Handles DELETE requests
  http.delete(
    `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/:id`,
    () => {
      // Respond with a 200 OK for successful deletion
      return new HttpResponse(null, { status: 200 });
    }
  ),
];

const server = setupServer(...handlers);

// --- Vitest Lifecycle Hooks for MSW ---
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

// =================================================================
// Test Suite Setup
// =================================================================

vi.mock("@tanstack/react-query", async () => {
  const actual = await import("@tanstack/react-query");
  return { ...actual };
});
vi.mock("react-intersection-observer", async () => {
  const actual = await import("react-intersection-observer");
  return { ...actual };
});

const queryClientTestConfig: QueryClientConfig = {
  defaultOptions: { queries: { retry: false } },
};
const createTestQueryClient = () => new QueryClient(queryClientTestConfig);

const setup = (ui: React.ReactElement, queryClient: QueryClient) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

vi.stubGlobal(
  "ResizeObserver",
  vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    unobserve: vi.fn(),
  }))
);

vi.mock("use-debounce", () => ({
  useDebouncedCallback: <T extends (..._arguments: unknown[]) => unknown>(
    function_: T
  ): T => function_,
}));

const MOCK_COLUMN_CONFIGS = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "user_name", header: "User Name" },
];

// =================================================================
// Tests
// =================================================================

describe("TablePagination", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("displays loading state initially", () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />,
      queryClient
    );
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("renders filter controls and applies filters", async () => {
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
      />,
      queryClient
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "User" }));
    expect(await screen.findByText("Jimmy_Nutron")).toBeInTheDocument();

    // Test infinite scroll for filters
    mockIsIntersecting(screen.getByTestId("infinite-scroll-trigger"), true);
    expect(await screen.findByText("Joe_Porter")).toBeInTheDocument();

    // Apply a filter
    await user.click(screen.getByText("Joe_Porter"));
    await waitFor(() =>
      expect(screen.queryByText("Tom_Never")).not.toBeInTheDocument()
    );
  });

  it("clears filters", async () => {
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
      />,
      queryClient
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "User" }));
    await user.click(await screen.findByText("Jimmy_Nutron"));

    // Wait for the filter to be applied and the clear button to appear
    const clearButton = await screen.findByLabelText("Clear all filters");
    expect(clearButton).toBeInTheDocument();

    // Clear the filter
    await user.click(clearButton);
    await waitFor(() =>
      expect(screen.getByText("Select User")).toBeInTheDocument()
    );
  });

  it("renders empty table when API returns no data", async () => {
    // Override the default handler for this specific test
    server.use(
      http.get(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
        () => {
          return HttpResponse.json({ data: [], limit: 10, page: 1, total: 0 });
        }
      )
    );
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />,
      queryClient
    );
    expect(await screen.findByText("No data available")).toBeInTheDocument();
  });

  it("renders a table with data and handles page navigation", async () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />,
      queryClient
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    // Initial state: page 1
    const previousButton = screen.getByLabelText("Go to previous page");
    const nextButton = screen.getByLabelText("Go to next page");
    expect(previousButton).toHaveClass("pointer-events-none opacity-50");

    // Navigate to next page
    const user = userEvent.setup();
    await user.click(nextButton);
    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();

    // New state: page 2
    expect(screen.getByLabelText("Go to previous page")).not.toHaveClass(
      "pointer-events-none opacity-50"
    );
    await user.click(screen.getByLabelText("Go to previous page"));
    await waitFor(() =>
      expect(screen.getByLabelText("Go to next page")).not.toHaveClass(
        "pointer-events-none opacity-50"
      )
    );
    await user.click(screen.getByLabelText("Go to page 5"));
    expect(await screen.findByText("Alice Johnson")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Go to page 8"));
    expect(await screen.findByText("Bob Brown")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to next page")).toHaveClass(
      "pointer-events-none opacity-50"
    );
  });

  it("handles clicking a page number", async () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />,
      queryClient
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("2"));

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
  });

  it("handles successful delete flow", async () => {
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />,
      queryClient
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open menu"));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByLabelText("Confirm delete"));

    // Wait for the dialog to close by asserting its button is no longer present.
    // Use queryBy... for non-existence checks.
    await waitFor(() => {
      expect(screen.queryByLabelText("Confirm delete")).not.toBeInTheDocument();
    });
  });
  it("sends the correct API request when a filter is applied", async () => {
    // 1. Override the default MSW handler for this specific test.
    // We want to verify that the `user_name` query parameter is correctly added to the API call.
    server.use(
      http.get(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
        ({ request }) => {
          const url = new URL(request.url);
          // If the request contains the filter we're about to apply,
          // return a unique user that we can assert against.
          if (url.searchParams.get("user_name") === "Jimmy_Nutron") {
            return HttpResponse.json({
              data: [{ id: 999, user_name: "Filtered Result: Jimmy" }],
              limit: 10,
              page: 1,
              total: 1,
            });
          }
          // Fallback to the default response for the initial render
          return HttpResponse.json({
            data: [{ id: 1, user_name: "John Doe" }],
            limit: 10,
            page: 1,
            total: 80,
          });
        }
      )
    );

    // 2. Render the component with filter configurations.
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        filterConfigs={[
          {
            apiField: "user_name", // This is the field sent to the API
            key: "user_name", // This is the internal state key
            label: "User",
            placeholder: "Select User",
          },
        ]}
        pageSize={10}
      />,
      queryClient
    );

    // Ensure initial data is loaded
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    // 3. Simulate the user selecting a filter option.
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "User" }));
    await user.click(await screen.findByText("Jimmy_Nutron"));

    // 4. Assert that the table now displays the unique data from our special handler.
    // This implicitly confirms that the `apiFilters` object was built correctly
    // and a new API request was sent with the `user_name=Jimmy_Nutron` query parameter.
    expect(
      await screen.findByText("Filtered Result: Jimmy")
    ).toBeInTheDocument();

    // Also assert the old data is gone
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("handles delete error", async () => {
    // Override the handler to simulate a server error on DELETE
    server.use(
      http.delete(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/:id`,
        () => {
          return new HttpResponse(undefined, {
            status: 500,
            statusText: "Internal Server Error",
          });
        }
      )
    );

    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />,
      queryClient
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open menu"));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByLabelText("Confirm delete"));

    // Check that the delete dialog remains open after error
    await waitFor(() =>
      expect(screen.getByText("Confirm Deletion")).toBeInTheDocument()
    );
  });

  it("renders error state on initial fetch failure", async () => {
    server.use(
      http.get(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
        () => {
          return new HttpResponse(undefined, { status: 500 });
        }
      )
    );
    setup(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />,
      queryClient
    );
    expect(
      await screen.findByText(
        "Failed to fetch table data: Internal Server Error"
      )
    ).toBeInTheDocument();
  });
});

// These tests do not require network requests, so they remain unchanged.
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

// This test can also use the MSW server, making it more consistent.
describe("fetchTableData", () => {
  it("fetches table data successfully", async () => {
    const result = await fetchTableData({}, 1, 10, MOCK_API_CONFIG);
    expect(result.data).toEqual([{ id: 1, user_name: "John Doe" }]);
    expect(result.total).toBe(80);
  });

  it("throws on fetch error", async () => {
    server.use(
      http.get(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
        () => {
          return new HttpResponse(undefined, {
            status: 500,
            statusText: "Server Error",
          });
        }
      )
    );
    await expect(fetchTableData({}, 1, 10, MOCK_API_CONFIG)).rejects.toThrow(
      "Server Error"
    );
  });
});
