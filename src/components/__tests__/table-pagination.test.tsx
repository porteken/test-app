import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import React from "react";
import {
  mockAllIsIntersecting,
  mockIsIntersecting,
} from "react-intersection-observer/test-utils";
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
  defaultOptions: {
    mutations: { retry: false },
    queries: {
      cacheTime: 0,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 0,
    },
  },
};
const createTestQueryClient = () => new QueryClient(queryClientTestConfig);

const setupRender = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  const utilities = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  return { queryClient, user, ...utilities };
};

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

const ARIA = {
  clearFilters: "Clear all filters",
  confirmDelete: "Confirm delete",
  dialogTitle: "Confirm Deletion",
  next: "Go to next page",
  openMenu: "Open menu",
  prev: "Go to previous page",
};

// Silence noisy network/react-query errors but keep useful ones
const originalConsoleError = console.error;
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((...arguments_: unknown[]) => {
    const [first] = arguments_;
    if (
      typeof first === "string" &&
      (first.includes("react-query") ||
        first.includes("Error fetching") ||
        first.includes("Uncaught [Error]"))
    ) {
      return;
    }
    // @ts-expect-error variadic
    originalConsoleError(...arguments_);
  });
});
afterAll(() => {
  (console.error as unknown as vi.SpyInstance).mockRestore();
});

// Helper MSW overrides
const useGetData = (impl: Parameters<typeof http.get>[1]) => {
  server.use(
    http.get(
      `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
      impl
    )
  );
};

const useDeleteData = (impl: Parameters<typeof http.delete>[1]) => {
  server.use(
    http.delete(
      `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.delete}/:id`,
      impl
    )
  );
};

// Reset intersection state after each test to avoid leakage
afterEach(() => {
  mockAllIsIntersecting(false);
});

// =================================================================
/* Tests */
// =================================================================

describe("TablePagination", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it("displays loading state initially", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TablePagination
          apiConfig={MOCK_API_CONFIG}
          columnConfigs={MOCK_COLUMN_CONFIGS}
          pageSize={10}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("applies filters with select", async () => {
    const { user } = setupRender(
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

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    expect(
      await screen.findByRole("option", { name: "Jimmy_Nutron" })
    ).toBeInTheDocument();

    // Ensure the sentinel exists, then trigger intersection
    await screen.findByTestId("infinite-scroll-trigger");
    mockIsIntersecting(screen.getByTestId("infinite-scroll-trigger"), true);

    expect(
      await screen.findByRole("option", { name: "Joe_Porter" })
    ).toBeInTheDocument();

    // Apply a filter
    await user.click(screen.getByRole("option", { name: "Joe_Porter" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Tom_Never" })
      ).not.toBeInTheDocument()
    );
  });
  it("applies filters with typing", async () => {
    const { user } = setupRender(
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

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    expect(await screen.findByLabelText("Search options")).toBeInTheDocument();

    // Apply a filter
    await user.type(screen.getByLabelText("Search options"), "J");
    await waitFor(async () =>
      expect(screen.queryByText("Lisa_Simpson")).toBeNull()
    );
    await user.type(screen.getByLabelText("Search options"), "J{enter}");
    await waitFor(async () =>
      expect(screen.queryByText("Jane_Smith")).toBeNull()
    );
  });
  it("applies filters with blank typing", async () => {
    const { user } = setupRender(
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

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    expect(await screen.findByLabelText("Search options")).toBeInTheDocument();

    // Apply a filter
    await user.type(screen.getByLabelText("Search options"), "{escape}");
  });

  it("clears filters with button press", async () => {
    const { user } = setupRender(
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

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    await user.click(
      await screen.findByRole("option", { name: "Jimmy_Nutron" })
    );

    const clearButton = await screen.findByRole("button", {
      name: ARIA.clearFilters,
    });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    await waitFor(() =>
      expect(screen.getByText("Select User")).toBeInTheDocument()
    );
  });

  it("clears filters with x", async () => {
    const { user } = setupRender(
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

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    await user.click(
      await screen.findByRole("option", { name: "Jimmy_Nutron" })
    );

    const clearButton = screen.getByLabelText("Clear filter for User");

    await user.click(clearButton);
    await waitFor(() =>
      expect(screen.getByText("Select User")).toBeInTheDocument()
    );
  });

  it("renders empty table when API returns no data", async () => {
    server.use(
      http.get(
        `${MOCK_API_CONFIG.baseUrl}${MOCK_API_CONFIG.endpoints.data}`,
        () => {
          return HttpResponse.json({ data: [], limit: 10, page: 1, total: 0 });
        }
      )
    );
    render(
      <QueryClientProvider client={queryClient}>
        <TablePagination
          apiConfig={MOCK_API_CONFIG}
          columnConfigs={MOCK_COLUMN_CONFIGS}
          pageSize={10}
        />
      </QueryClientProvider>
    );
    expect(await screen.findByText("No data available")).toBeInTheDocument();
  });

  it("renders a table with data and handles page navigation", async () => {
    const { user } = setupRender(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    const previousButton = screen.getByLabelText(ARIA.prev);
    const nextButton = screen.getByLabelText(ARIA.next);

    // If your UI uses disabled attribute, prefer toBeDisabled()
    // Here original code checks classes; preserve that behavior:
    expect(previousButton).toHaveClass("pointer-events-none opacity-50");

    await user.click(nextButton);
    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(ARIA.prev)).not.toHaveClass(
        "pointer-events-none opacity-50"
      );
    });

    await user.click(screen.getByLabelText("Go to previous page"));
    await waitFor(() =>
      expect(screen.getByLabelText(ARIA.next)).not.toHaveClass(
        "pointer-events-none opacity-50"
      )
    );

    await user.click(screen.getByLabelText("Go to page 5"));
    expect(await screen.findByText("Alice Johnson")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Go to page 8"));
    expect(await screen.findByText("Bob Brown")).toBeInTheDocument();

    expect(screen.getByLabelText(ARIA.next)).toHaveClass(
      "pointer-events-none opacity-50"
    );
  });

  it("handles clicking a page number", async () => {
    const { user } = setupRender(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        pageSize={10}
      />
    );

    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    await user.click(screen.getByText("2"));

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
  });

  it("handles successful delete flow", async () => {
    const { user } = setupRender(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ARIA.openMenu }));
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    await user.click(
      await screen.findByRole("button", { name: ARIA.confirmDelete })
    );

    // Wait for the dialog to close
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: ARIA.confirmDelete })
      ).not.toBeInTheDocument();
    });
  });

  it("sends the correct API request when a filter is applied", async () => {
    useGetData(({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("user_name") === "Jimmy_Nutron") {
        return HttpResponse.json({
          data: [{ id: 999, user_name: "Filtered Result: Jimmy" }],
          limit: 10,
          page: 1,
          total: 1,
        });
      }
      return HttpResponse.json({
        data: [{ id: 1, user_name: "John Doe" }],
        limit: 10,
        page: 1,
        total: 80,
      });
    });

    const { user } = setupRender(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        filterConfigs={[
          {
            apiField: "user_name", // field sent to the API
            key: "user_name", // internal state key
            label: "User",
            placeholder: "Select User",
          },
        ]}
        pageSize={10}
      />
    );

    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /user/i }));
    await user.click(
      await screen.findByRole("option", { name: "Jimmy_Nutron" })
    );

    expect(
      await screen.findByText("Filtered Result: Jimmy")
    ).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("handles delete error", async () => {
    useDeleteData(() => {
      return new HttpResponse(undefined, {
        status: 500,
        statusText: "Internal Server Error",
      });
    });

    const { user } = setupRender(
      <TablePagination
        apiConfig={MOCK_API_CONFIG}
        columnConfigs={MOCK_COLUMN_CONFIGS}
        enableDelete
        pageSize={10}
      />
    );
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ARIA.openMenu }));
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
    await user.click(
      await screen.findByRole("button", { name: ARIA.confirmDelete })
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: new RegExp(ARIA.dialogTitle, "i") })
      ).toBeInTheDocument()
    );
  });

  it("renders error state on initial fetch failure", async () => {
    useGetData(() => {
      return new HttpResponse(undefined, {
        status: 500,
        statusText: "Internal Server Error",
      });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TablePagination
          apiConfig={MOCK_API_CONFIG}
          columnConfigs={MOCK_COLUMN_CONFIGS}
          pageSize={10}
        />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(
        /failed to fetch table data: internal server error/i
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
      /Server Error|Internal Server Error/
    );
  });
});
