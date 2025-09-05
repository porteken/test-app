// src/mocks/handlers.ts

import { http, HttpResponse } from "msw";

// Ensure this import path is correct for your project
import type { Entity, InfiniteQueryPage } from "../components/infinite-select";

// A large, stable array of mock data to simulate a real database
const allEntities: Entity[] = Array.from({ length: 100 }, (_, index) => ({
  id: `entity-${index + 1}`,
  name: `Mock Entity ${index + 1}`,
}));

export const handlers = [
  // The final, "smart" handler for the entities API
  http.get("/api/entities", ({ request }) => {
    // 1. Read the search and page parameters from the request URL
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = 15; // How many items per page

    // 2. Simulate database filtering based on the search term
    const filteredEntities = allEntities.filter(entity =>
      entity.name.toLowerCase().includes(search.toLowerCase())
    );

    // 3. Simulate database pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedItems = filteredEntities.slice(start, end);

    const response: InfiniteQueryPage<Entity> = {
      items: paginatedItems,
      // 4. Calculate if there is a next page and return its number
      nextPage: end < filteredEntities.length ? page + 1 : undefined,
    };

    // 5. Return the dynamically generated page of data
    return HttpResponse.json(response);
  }),
];
