import '@testing-library/jest-dom'

// Polyfill ResizeObserver for components that use cmdk or other libraries requiring it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill scrollIntoView for jsdom (used by cmdk Command list items)
Element.prototype.scrollIntoView = function () {};
