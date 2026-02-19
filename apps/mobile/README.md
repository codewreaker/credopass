# Mobile App Setup

## API Configuration

The mobile app is configured to use the shared `@credopass/api-client` package for all API calls.

### Environment Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Update the API URL in `.env`:**
   ```bash
   # For local development (use your machine's IP, not localhost)
   API_URL=http://192.168.1.100:3000/api/core
   
   # For production
   # API_URL=https://api.credopass.app/api/core
   ```

3. **Or configure in `app.json`:**
   ```json
   {
     "expo": {
       "extra": {
         "apiUrl": "http://192.168.1.100:3000/api/core"
       }
     }
   }
   ```

### Why use IP address instead of localhost?

When developing on a physical device or emulator, `localhost` refers to the device itself, not your development machine. Use your computer's local IP address instead:

- **macOS/Linux:** Run `ifconfig | grep "inet "` to find your IP
- **Windows:** Run `ipconfig` to find your IPv4 address

### API Client Initialization

The API client is automatically configured on app startup in [app.tsx](src/app.tsx):

```tsx
import Constants from 'expo-constants';
import { configureAPIClient } from '@credopass/api-client';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/core';

configureAPIClient({ baseURL: API_BASE_URL });
```

### Usage in Components

After initialization, use TanStack DB collections as normal:

```tsx
import { getCollections } from '@credopass/api-client/collections';
import { useLiveQuery } from '@tanstack/react-db';

function EventsList() {
  const { events: eventCollection } = getCollections();
  const { data: events } = useLiveQuery((q) => q.from({ eventCollection }));
  
  return (
    <FlatList
      data={events}
      renderItem={({ item }) => <EventRow event={item} />}
    />
  );
}
```

## Running the App

```bash
# iOS
bun run ios

# Android
bun run android

# Or use Nx
nx run mobile:ios
nx run mobile:android
```

## Environment Variables Priority

The app checks for API URL in this order:

1. `Constants.expoConfig?.extra?.apiUrl` (from app.json)
2. Fallback: `http://localhost:3000/api/core`

Choose the method that works best for your workflow. `app.json` is simpler for quick changes, while environment variables are better for managing multiple environments.
