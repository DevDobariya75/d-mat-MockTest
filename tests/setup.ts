import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Each test starts from an empty browser store and an unmounted DOM.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
