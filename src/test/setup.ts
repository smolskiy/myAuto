import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest без globals: Testing Library сама DOM между тестами не чистит.
afterEach(cleanup)

// waitFor/findBy по умолчанию ждут 1 с — под нагрузкой полного прогона экран не всегда успевает.
configure({ asyncUtilTimeout: 5000 })
