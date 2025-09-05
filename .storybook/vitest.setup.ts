import "@testing-library/jest-dom";
import { vi } from "vitest";

// Polyfill for hasPointerCapture
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function (_pointerId) {
    return false;
  };
}

// Polyfill for scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// Mock window.alert
globalThis.alert = vi.fn();

const intersectionObserverMock = () => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
});

globalThis.IntersectionObserver = vi
  .fn()
  .mockImplementation(intersectionObserverMock);
