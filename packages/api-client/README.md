# @credopass/api-client

Shared API client for both web and mobile applications using TanStack DB.

## Setup

The API client needs to be configured with your environment-specific API base URL before use.

### Web App (Vite)

In your `main.tsx` or entry file:

```tsx
import { configureAPIClient } from '@credopass/api-client';
import { API_BASE_URL } from './config';

// Configure before using getCollections()
configureAPIClient({ baseURL: API_BASE_URL });
```

### Mobile App (Expo)

In your `App.tsx` or entry file:

```tsx
import { configureAPIClient } from '@credopass/api-client';
import Constants from 'expo-constants';

// Get API URL from Expo config or environment
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/core';

// Configure before using getCollections()
configureAPIClient({ baseURL: API_BASE_URL });
```

## Usage

After configuration, use the collections as normal:

```tsx
import { getCollections } from '@credopass/api-client/collections';
import { useLiveQuery } from '@tanstack/react-db';

function MyComponent() {
  const { events: eventCollection } = getCollections();
  const { data: events } = useLiveQuery((q) => q.from({ eventCollection }));
  
  // ... rest of component
}
```

## Environment Variables

### Web (Vite)
Set in `.env`:
```
VITE_API_URL=https://api.yourdomain.com
```

### Mobile (Expo)
Set in `app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.yourdomain.com"
    }
  }
}
```

Or use `.env` with `expo-constants`:
```
API_URL=https://api.yourdomain.com
```
