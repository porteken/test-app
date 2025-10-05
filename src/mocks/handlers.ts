// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";

type InfiniteQueryPageKV = { items: KVItem[]; nextPage?: number };
// Local KV types to avoid importing from component code
type KVItem = { key: string; value: string };

// Generate a stable data set
const allEntities: KVItem[] = Array.from({ length: 100 }, (_, index) => ({
  key: `entity-${index + 1}`,
  value: `Mock Entity ${index + 1}`,
}));

export const handlers = [
  http.get("/api/entities", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = 15;

    const filtered = allEntities.filter(item =>
      item.value.toLowerCase().includes(search.toLowerCase())
    );

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedItems = filtered.slice(start, end);

    const response: InfiniteQueryPageKV = {
      items: paginatedItems,
      nextPage: end < filtered.length ? page + 1 : undefined,
    };

    return HttpResponse.json(response);
  }),
];
