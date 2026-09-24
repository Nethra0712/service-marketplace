import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// `globals: false` in vitest.config.ts means RTL can't auto-detect a global
// `afterEach` to hook its own cleanup into, so it's done explicitly here.
afterEach(cleanup);
