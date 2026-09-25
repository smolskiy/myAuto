import { RouterProvider } from 'react-router'
import { createAppRouter } from './routes'

const router = createAppRouter()

export default function AppRouter() {
  return <RouterProvider router={router} />
}
