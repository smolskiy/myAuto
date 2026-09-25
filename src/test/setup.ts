import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest без globals: Testing Library сама DOM между тестами не чистит.
afterEach(cleanup)
