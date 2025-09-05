// src/mocks/browser.ts

import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

// This configures a Service Worker with the request handlers you defined.
export const worker = setupWorker(...handlers);
