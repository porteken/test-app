// .storybook/preview.ts

import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

/**
 * Conditionally import and start MSW.
 * This is the official MSW way to set up for browsers.
 */
async function startMsw() {
  // We only want to start MSW in a browser environment
  if (globalThis.window !== undefined) {
    console.log("[MSW Manual Start] Attempting to start the worker...");

    // Import the worker configuration from your mocks folder
    const { worker } = await import("../src/mocks/browser");

    // Start the worker. This is an async operation.
    await worker.start({
      onUnhandledRequest: "bypass", // Let non-mocked requests pass through
      quiet: true, // Reduce console noise for static assets
    });

    console.log("[MSW Manual Start] Worker has been started.");
  }
}

const preview: Preview = {
  // loaders are used to run async tasks before a story renders.
  // We will use it to ensure MSW is running.
  loaders: [
    async () => {
      // Ensure the worker is started before any stories are rendered
      await startMsw();
      // Loaders must return an empty object
      return {};
    },
  ],

  parameters: {
    a11y: { test: "todo" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
  },
};

export default preview;
