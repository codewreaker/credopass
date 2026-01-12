# API Reference

Complete API endpoint documentation for the CredoPass backend.

**CredoPass** provides detailed event attendance tracking—capturing who attended, when they checked in/out, and attendance analytics. Unlike ticketing platforms (EventBrite, Meetup), CredoPass focuses on attendance data, not ticket sales. Perfect for free events, paid events managed elsewhere, or any organization needing detailed attendance records.

---

## Table of Contents

- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Users API](#users-api)
- [Events API](#events-api)
- [Attendance API](#attendance-api)
- [Loyalty API](#loyalty-api)
- [Error Handling](#error-handling)

---

## API Overview

### Base URL

**Development**:
```
http://localhost:3000
```

**Production**:
```
https://api.credopass.com
```

### Response Format

All API responses follow a consistent JSON format:

**Success Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Error Response**:
```json
{
  "error": "User not found",
  "status": 404
}
```

### Common Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input data |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## Authentication

**Current Status**: No authentication required (public API)

**Future**: Will implement JWT-based authentication

---

## Users API

### List All Users

```http
GET /api/users
```

**Description**: Retrieve all users, ordered by creation date (newest first).

**Request**:
```bash
curl http://localhost:3000/api/users
```

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "createdAt": "2026-01-10T10:00:00.000Z",
    "updatedAt": "2026-01-10T10:00:00.000Z"
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": null,
    "createdAt": "2026-01-09T15:30:00.000Z",
    "updatedAt": "2026-01-09T15:30:00.000Z"
  }
]
```

---

### Get Single User

```http
GET /api/users/:id
```

**Description**: Retrieve a specific user by ID.

**Parameters**:
- `id` (path, required) - User UUID

**Request**:
```bash
curl http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "createdAt": "2026-01-10T10:00:00.000Z",
  "updatedAt": "2026-01-10T10:00:00.000Z"
}
```

**Error Response** (404 Not Found):
```json
{
  "error": "User not found"
}
```

---

### Create User

```http
POST /api/users
```

**Description**: Create a new user.

**Request Body**:
```json
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Validation Rules**:
- `email` (required, string, valid email format)
- `firstName` (required, string, min 1 character)
- `lastName` (required, string, min 1 character)
- `phone` (optional, string)

**Request**:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }'
```

**Response** (201 Created):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "createdAt": "2026-01-11T10:00:00.000Z",
  "updatedAt": "2026-01-11T10:00:00.000Z"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    }
  ]
}
```

---

### Update User

```http
PUT /api/users/:id
```

**Description**: Update an existing user.

**Parameters**:
- `id` (path, required) - User UUID

**Request Body** (all fields optional except id):
```json
{
  "firstName": "Jonathan",
  "phone": "+1987654321"
}
```

**Request**:
```bash
curl -X PUT http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jonathan",
    "phone": "+1987654321"
  }'
```

**Response** (200 OK):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "john@example.com",
  "firstName": "Jonathan",
  "lastName": "Doe",
  "phone": "+1987654321",
  "createdAt": "2026-01-10T10:00:00.000Z",
  "updatedAt": "2026-01-11T12:30:00.000Z"
}
```

---

### Delete User

```http
DELETE /api/users/:id
```

**Description**: Delete a user (cascades to events, attendance, and loyalty records).

**Parameters**:
- `id` (path, required) - User UUID

**Request**:
```bash
curl -X DELETE http://localhost:3000/api/users/123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):
```json
{
  "message": "User deleted"
}
```

---

## Events API

### List All Events

```http
GET /api/events
```

**Description**: Retrieve all events, ordered by start time (newest first).

**Request**:
```bash
curl http://localhost:3000/api/events
```

**Response** (200 OK):
```json
[
  {
    "id": "323e4567-e89b-12d3-a456-426614174002",
    "name": "Friday Jazz Night",
    "description": "Weekly jazz performance and networking",
    "status": "scheduled",
    "startTime": "2026-01-12T10:00:00.000Z",
    "endTime": "2026-01-12T12:00:00.000Z",
    "location": "Main Sanctuary",
    "capacity": 500,
    "hostId": "123e4567-e89b-12d3-a456-426614174000",
    "createdAt": "2026-01-10T10:00:00.000Z",
    "updatedAt": "2026-01-10T10:00:00.000Z"
  }
]
```

---

### Get Single Event

```http
GET /api/events/:id
```

**Description**: Retrieve a specific event by ID.

**Parameters**:
- `id` (path, required) - Event UUID

**Request**:
```bash
curl http://localhost:3000/api/events/323e4567-e89b-12d3-a456-426614174002
```

**Response** (200 OK):
```json
{
  "id": "323e4567-e89b-12d3-a456-426614174002",
  "name": "Friday Jazz Night",
  "description": "Weekly jazz performance and networking",
  "status": "scheduled",
  "startTime": "2026-01-17T19:00:00.000Z",
  "endTime": "2026-01-17T23:00:00.000Z",
  "location": "Blue Note Jazz Club",
  "capacity": 500,
  "hostId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2026-01-10T10:00:00.000Z",
  "updatedAt": "2026-01-10T10:00:00.000Z"
}
```

---

### Create Event

```http
POST /api/events
```

**Description**: Create a new event.

**Request Body**:
```json
{
  "name": "Friday Jazz Night",
  "description": "Weekly jazz performance and networking",
  "status": "scheduled",
  "startTime": "2026-01-17T19:00:00.000Z",
  "endTime": "2026-01-17T23:00:00.000Z",
  "location": "Blue Note Jazz Club",
  "capacity": 500,
  "hostId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Validation Rules**:
- `name` (required, string, min 1 character)
- `description` (optional, string)
- `status` (required, enum: `draft`, `scheduled`, `ongoing`, `completed`, `cancelled`)
- `startTime` (required, ISO 8601 date string)
- `endTime` (required, ISO 8601 date string, must be after startTime)
- `location` (required, string)
- `capacity` (optional, integer, min 1)
- `hostId` (required, UUID, must reference existing user)

**Request**:
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Friday Jazz Night",
    "description": "Weekly jazz performance and networking",
    "status": "scheduled",
    "startTime": "2026-01-17T19:00:00.000Z",
    "endTime": "2026-01-17T23:00:00.000Z",
    "location": "Blue Note Jazz Club",
    "capacity": 500,
    "hostId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Response** (201 Created):
```json
{
  "id": "323e4567-e89b-12d3-a456-426614174002",
  "name": "Friday Jazz Night",
  "description": "Weekly jazz performance and networking",
  "status": "scheduled",
  "startTime": "2026-01-17T19:00:00.000Z",
  "endTime": "2026-01-17T23:00:00.000Z",
  "location": "Blue Note Jazz Club",
  "capacity": 500,
  "hostId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2026-01-11T10:00:00.000Z",
  "updatedAt": "2026-01-11T10:00:00.000Z"
}
```

---

### Update Event

```http
PUT /api/events/:id
```

**Description**: Update an existing event.

**Parameters**:
- `id` (path, required) - Event UUID

**Request Body** (all fields optional):
```json
{
  "status": "ongoing",
  "capacity": 600
}
```

**Request**:
```bash
curl -X PUT http://localhost:3000/api/events/323e4567-e89b-12d3-a456-426614174002 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ongoing"
  }'
```

**Response** (200 OK):
```json
{
  "id": "323e4567-e89b-12d3-a456-426614174002",
  "name": "Friday Jazz Night",
  "status": "ongoing",
  "startTime": "2026-01-17T19:00:00.000Z",
  "endTime": "2026-01-17T23:00:00.000Z",
  "location": "Blue Note Jazz Club",
  "capacity": 500,
  "hostId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2026-01-10T10:00:00.000Z",
  "updatedAt": "2026-01-12T10:05:00.000Z"
}
```

---

### Delete Event

```http
DELETE /api/events/:id
```

**Description**: Delete an event (cascades to attendance records).

**Parameters**:
- `id` (path, required) - Event UUID

**Request**:
```bash
curl -X DELETE http://localhost:3000/api/events/323e4567-e89b-12d3-a456-426614174002
```

**Response** (200 OK):
```json
{
  "message": "Event deleted"
}
```

---

## Attendance API

### List All Attendance Records

```http
GET /api/attendance
```

**Description**: Retrieve all attendance records.

**Request**:
```bash
curl http://localhost:3000/api/attendance
```

**Response** (200 OK):
```json
[
  {
    "id": "423e4567-e89b-12d3-a456-426614174003",
    "eventId": "323e4567-e89b-12d3-a456-426614174002",
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "attended": true,
    "checkInTime": "2026-01-12T09:55:00.000Z",
    "checkOutTime": "2026-01-12T12:05:00.000Z"
  }
]
```

---

### Get Attendance Record

```http
GET /api/attendance/:id
```

**Description**: Retrieve a specific attendance record.

**Parameters**:
- `id` (path, required) - Attendance UUID

**Request**:
```bash
curl http://localhost:3000/api/attendance/423e4567-e89b-12d3-a456-426614174003
```

**Response** (200 OK):
```json
{
  "id": "423e4567-e89b-12d3-a456-426614174003",
  "eventId": "323e4567-e89b-12d3-a456-426614174002",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "attended": true,
  "checkInTime": "2026-01-12T09:55:00.000Z",
  "checkOutTime": "2026-01-12T12:05:00.000Z"
}
```

---

### Get Attendance by Event

```http
GET /api/attendance/event/:eventId
```

**Description**: Retrieve all attendance records for a specific event.

**Parameters**:
- `eventId` (path, required) - Event UUID

**Request**:
```bash
curl http://localhost:3000/api/attendance/event/323e4567-e89b-12d3-a456-426614174002
```

**Response** (200 OK):
```json
[
  {
    "id": "423e4567-e89b-12d3-a456-426614174003",
    "eventId": "323e4567-e89b-12d3-a456-426614174002",
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "attended": true,
    "checkInTime": "2026-01-12T09:55:00.000Z",
    "checkOutTime": null
  },
  {
    "id": "523e4567-e89b-12d3-a456-426614174004",
    "eventId": "323e4567-e89b-12d3-a456-426614174002",
    "patronId": "223e4567-e89b-12d3-a456-426614174001",
    "attended": true,
    "checkInTime": "2026-01-12T10:05:00.000Z",
    "checkOutTime": null
  }
]
```

---

### Create Attendance Record

```http
POST /api/attendance
```

**Description**: Create a new attendance record (RSVP or check-in).

**Request Body**:
```json
{
  "eventId": "323e4567-e89b-12d3-a456-426614174002",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "attended": true,
  "checkInTime": "2026-01-12T09:55:00.000Z"
}
```

**Validation Rules**:
- `eventId` (required, UUID, must reference existing event)
- `patronId` (required, UUID, must reference existing user)
- `attended` (optional, boolean, default false)
- `checkInTime` (optional, ISO 8601 date string)
- `checkOutTime` (optional, ISO 8601 date string)

**Request**:
```bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "323e4567-e89b-12d3-a456-426614174002",
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "attended": true,
    "checkInTime": "2026-01-12T09:55:00.000Z"
  }'
```

**Response** (201 Created):
```json
{
  "id": "423e4567-e89b-12d3-a456-426614174003",
  "eventId": "323e4567-e89b-12d3-a456-426614174002",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "attended": true,
  "checkInTime": "2026-01-12T09:55:00.000Z",
  "checkOutTime": null
}
```

---

### Update Attendance Record

```http
PUT /api/attendance/:id
```

**Description**: Update attendance status or check-out time.

**Parameters**:
- `id` (path, required) - Attendance UUID

**Request Body**:
```json
{
  "attended": true,
  "checkOutTime": "2026-01-12T12:05:00.000Z"
}
```

**Request**:
```bash
curl -X PUT http://localhost:3000/api/attendance/423e4567-e89b-12d3-a456-426614174003 \
  -H "Content-Type: application/json" \
  -d '{
    "checkOutTime": "2026-01-12T12:05:00.000Z"
  }'
```

**Response** (200 OK):
```json
{
  "id": "423e4567-e89b-12d3-a456-426614174003",
  "eventId": "323e4567-e89b-12d3-a456-426614174002",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "attended": true,
  "checkInTime": "2026-01-12T09:55:00.000Z",
  "checkOutTime": "2026-01-12T12:05:00.000Z"
}
```

---

### Delete Attendance Record

```http
DELETE /api/attendance/:id
```

**Description**: Delete an attendance record.

**Parameters**:
- `id` (path, required) - Attendance UUID

**Request**:
```bash
curl -X DELETE http://localhost:3000/api/attendance/423e4567-e89b-12d3-a456-426614174003
```

**Response** (200 OK):
```json
{
  "message": "Attendance record deleted"
}
```

---

## Loyalty API

### List All Loyalty Records

```http
GET /api/loyalty
```

**Description**: Retrieve all loyalty records.

**Request**:
```bash
curl http://localhost:3000/api/loyalty
```

**Response** (200 OK):
```json
[
  {
    "id": "623e4567-e89b-12d3-a456-426614174005",
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "description": "Attendance at Sunday Service",
    "tier": "gold",
    "points": 10,
    "reward": null,
    "issuedAt": "2026-01-12T12:00:00.000Z",
    "expiresAt": null
  }
]
```

---

### Get Loyalty Record

```http
GET /api/loyalty/:id
```

**Description**: Retrieve a specific loyalty record.

**Parameters**:
- `id` (path, required) - Loyalty UUID

**Request**:
```bash
curl http://localhost:3000/api/loyalty/623e4567-e89b-12d3-a456-426614174005
```

**Response** (200 OK):
```json
{
  "id": "623e4567-e89b-12d3-a456-426614174005",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Attendance at Sunday Service",
  "tier": "gold",
  "points": 10,
  "reward": null,
  "issuedAt": "2026-01-12T12:00:00.000Z",
  "expiresAt": null
}
```

---

### Get Loyalty by User

```http
GET /api/loyalty/user/:patronId
```

**Description**: Retrieve all loyalty records for a specific user.

**Parameters**:
- `patronId` (path, required) - User UUID

**Request**:
```bash
curl http://localhost:3000/api/loyalty/user/123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):
```json
[
  {
    "id": "623e4567-e89b-12d3-a456-426614174005",
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "description": "Attended Friday Jazz Night",
    "tier": "gold",
    "points": 10,
    "reward": null,
    "issuedAt": "2026-01-12T12:00:00.000Z",
    "expiresAt": null
  }
]
```

---

### Create Loyalty Record

```http
POST /api/loyalty
```

**Description**: Award loyalty points to a user.

**Request Body**:
```json
{
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Attended Friday Jazz Night",
  "tier": "gold",
  "points": 10,
  "reward": null,
  "expiresAt": "2027-01-12T00:00:00.000Z"
}
```

**Validation Rules**:
- `patronId` (required, UUID, must reference existing user)
- `description` (required, string)
- `tier` (optional, enum: `bronze`, `silver`, `gold`, `platinum`)
- `points` (optional, integer, default 0)
- `reward` (optional, string)
- `expiresAt` (optional, ISO 8601 date string)

**Request**:
```bash
curl -X POST http://localhost:3000/api/loyalty \
  -H "Content-Type: application/json" \
  -d '{
    "patronId": "123e4567-e89b-12d3-a456-426614174000",
    "description": "Attended Friday Jazz Night",
    "tier": "gold",
    "points": 10
  }'
```

**Response** (201 Created):
```json
{
  "id": "623e4567-e89b-12d3-a456-426614174005",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Attended Friday Jazz Night",
  "tier": "gold",
  "points": 10,
  "reward": null,
  "issuedAt": "2026-01-11T10:00:00.000Z",
  "expiresAt": null
}
```

---

### Update Loyalty Record

```http
PUT /api/loyalty/:id
```

**Description**: Update loyalty points or tier.

**Parameters**:
- `id` (path, required) - Loyalty UUID

**Request Body**:
```json
{
  "tier": "platinum",
  "points": 50
}
```

**Request**:
```bash
curl -X PUT http://localhost:3000/api/loyalty/623e4567-e89b-12d3-a456-426614174005 \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "platinum"
  }'
```

**Response** (200 OK):
```json
{
  "id": "623e4567-e89b-12d3-a456-426614174005",
  "patronId": "123e4567-e89b-12d3-a456-426614174000",
  "description": "Attended Friday Jazz Night",
  "tier": "platinum",
  "points": 10,
  "reward": null,
  "issuedAt": "2026-01-12T12:00:00.000Z",
  "expiresAt": null
}
```

---

### Delete Loyalty Record

```http
DELETE /api/loyalty/:id
```

**Description**: Delete a loyalty record.

**Parameters**:
- `id` (path, required) - Loyalty UUID

**Request**:
```bash
curl -X DELETE http://localhost:3000/api/loyalty/623e4567-e89b-12d3-a456-426614174005
```

**Response** (200 OK):
```json
{
  "message": "Loyalty record deleted"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent structure:

```json
{
  "error": "Error message",
  "status": 400,
  "issues": [
    {
      "path": ["fieldName"],
      "message": "Specific validation error"
    }
  ]
}
```

### Common Error Scenarios

#### Validation Error (400)

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'
```

Response:
```json
{
  "error": "Validation failed",
  "status": 400,
  "issues": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    },
    {
      "path": ["firstName"],
      "message": "First name is required"
    }
  ]
}
```

#### Not Found (404)

```bash
curl http://localhost:3000/api/users/nonexistent-id
```

Response:
```json
{
  "error": "User not found",
  "status": 404
}
```

#### Server Error (500)

```bash
# Database connection failed
```

Response:
```json
{
  "error": "Internal server error",
  "status": 500
}
```

---

## Testing the API

### Health Check

```bash
# Test if API is running
curl http://localhost:3000/api/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-01-11T10:00:00.000Z"
}
```

### Postman Collection

Import these endpoints into Postman for easier testing:

**Base URL**: `{{baseUrl}}` → `http://localhost:3000`

**Endpoints**:
- GET `{{baseUrl}}/api/health`
- GET `{{baseUrl}}/api/users`
- POST `{{baseUrl}}/api/users`
- GET `{{baseUrl}}/api/events`
- POST `{{baseUrl}}/api/events`
- (etc.)

---

## Next Steps

- **Frontend Integration**: See [ARCHITECTURE.md](ARCHITECTURE.md) for API client usage
- **Database Schema**: See [DATABASE.md](DATABASE.md) for table definitions
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production API setup
