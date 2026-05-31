import { vi } from 'vitest';

// Silence verbose debug console.log calls from service implementations
// (e.g. sleep score debug output, health metrics logging).
// console.warn and console.error stay active so real problems surface.
vi.spyOn(console, 'log').mockImplementation(() => {});
