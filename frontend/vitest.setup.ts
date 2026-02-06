/**
 * Vitest Setup File
 * 
 * Configures test environment with necessary mocks and polyfills.
 * This file runs before all tests.
 */

// Mock IndexedDB for Dexie.js tests in Node.js environment
import 'fake-indexeddb/auto';
