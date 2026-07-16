import { createFileRoute, redirect } from '@tanstack/react-router'

// Default redirect path - change this to redirect '/' to any route
const DEFAULT_REDIRECT_PATH = '/login'


// Index route - redirects to the default path (currently /checkin)
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: DEFAULT_REDIRECT_PATH, search: {
        view: 'social'
      }
    })
  },
})