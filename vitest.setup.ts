import '@testing-library/jest-dom';

// Polyfill for hasPointerCapture
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function(pointerId) {
    return false;
  };
}

// Polyfill for scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function() {};
}

// Mock window.alert
window.alert = vi.fn();