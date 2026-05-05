# CRM API v1 Documentation

## Overview

The CRM API v1 provides programmatic access to manage leads and interactions. All endpoints require authentication using an API Key.

## Authentication

All requests to the API must include an `Authorization` header with a Bearer token:

```
Authorization: Bearer <CRM_API_KEY>
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key-here" \
  https://your-crm.example.com/api/v1/leads
```

## Base URL

```
https://your-crm.example.com/api/v1
```

## Webhooks

The API can send webhook notifications to your application when certain events occur.

### Webhook Security

All webhooks include an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the request body.

To validate a webhook:

1. Get the `X-Webhook-Signature` header (format: `sha256=<hash>`)
2. Compute HMAC-SHA256 of the request body using your `CRM_WEBHOOK_SECRET`
3. Compare the computed hash with the one in the header

**Example (Node.js):**
```javascript
const crypto = require('crypto');

function validateWebhook(payload, signature, secret) {
  const [algo, hash] = signature.split('=');
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(expectedHash)
  );
}
```

## Endpoints

### Leads

#### List Leads

```http
GET /api/v1/leads
```

**Query Parameters:**
- `limit` (integer, default: 50, max: 100) - Number of results to return
- `offset` (integer, default: 0) - Number of results to skip
- `status` (string) - Filter by lead status (prospect, qualified, contacted, converted, lost)
- `search` (string) - Search by name, email, or phone

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  "https://your-crm.example.com/api/v1/leads?status=prospect&limit=10&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "company": "Acme Corp",
      "status": "prospect",
      "source": "website",
      "value": 5000,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Lead

```http
GET /api/v1/leads/{id}
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  https://your-crm.example.com/api/v1/leads/lead-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead-123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Acme Corp",
    "status": "prospect",
    "source": "website",
    "value": 5000,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "interactions": [
      {
        "id": "int-456",
        "type": "email",
        "notes": "Sent proposal",
        "createdAt": "2024-01-15T11:00:00Z"
      }
    ]
  }
}
```

#### Create Lead

```http
POST /api/v1/leads
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+9876543210",
  "company": "Tech Innovations",
  "status": "prospect",
  "source": "api",
  "value": 10000
}
```

**Fields:**
- `name` (string, required) - Lead name
- `email` (string, optional) - Email address
- `phone` (string, optional) - Phone number
- `company` (string, optional) - Company name
- `status` (string, optional, default: "prospect") - Lead status
- `source` (string, optional, default: "api") - How the lead was acquired
- `value` (number, optional) - Deal value

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "lead-new-789",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+9876543210",
    "company": "Tech Innovations",
    "status": "prospect",
    "source": "api",
    "value": 10000,
    "createdAt": "2024-01-20T14:30:00Z",
    "updatedAt": "2024-01-20T14:30:00Z"
  }
}
```

#### Update Lead

```http
PATCH /api/v1/leads/{id}
Content-Type: application/json

{
  "status": "qualified",
  "value": 15000
}
```

**Fields:** All fields from Create Lead are optional for updates

**Response:** Same as Create Lead

#### Delete Lead

```http
DELETE /api/v1/leads/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

## Webhook Events

### lead.created

Triggered when a new lead is created.

```json
{
  "event": "lead.created",
  "timestamp": "2024-01-20T14:30:00Z",
  "data": {
    "id": "lead-new-789",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+9876543210",
    "company": "Tech Innovations",
    "status": "prospect",
    "source": "api",
    "value": 10000,
    "createdAt": "2024-01-20T14:30:00Z"
  }
}
```

### lead.updated

Triggered when a lead is updated.

```json
{
  "event": "lead.updated",
  "timestamp": "2024-01-20T15:00:00Z",
  "data": {
    "id": "lead-123",
    "name": "John Doe",
    "status": "qualified",
    "value": 7500,
    "updatedAt": "2024-01-20T15:00:00Z"
  }
}
```

### lead.deleted

Triggered when a lead is deleted.

```json
{
  "event": "lead.deleted",
  "timestamp": "2024-01-20T15:30:00Z",
  "data": {
    "id": "lead-123",
    "deletedAt": "2024-01-20T15:30:00Z"
  }
}
```

### interaction.created

Triggered when an interaction is created for a lead.

```json
{
  "event": "interaction.created",
  "timestamp": "2024-01-20T16:00:00Z",
  "data": {
    "id": "int-890",
    "leadId": "lead-123",
    "type": "call",
    "notes": "Discussed pricing",
    "createdAt": "2024-01-20T16:00:00Z"
  }
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Field 'name' is required"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing Authorization header"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Lead not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Database connection failed"
}
```

## Rate Limiting

Currently, there is no rate limiting. However, we recommend:
- Max 100 results per request
- Pagination for large datasets
- Caching on the client side when possible

## Examples

### JavaScript/Node.js

```javascript
const CRM_API_KEY = 'your-api-key';
const CRM_BASE_URL = 'https://your-crm.example.com/api/v1';

// List leads
async function getLeads() {
  const response = await fetch(`${CRM_BASE_URL}/leads?status=prospect&limit=10`, {
    headers: {
      'Authorization': `Bearer ${CRM_API_KEY}`
    }
  });
  return response.json();
}

// Create lead
async function createLead(data) {
  const response = await fetch(`${CRM_BASE_URL}/leads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

// Update lead
async function updateLead(leadId, data) {
  const response = await fetch(`${CRM_BASE_URL}/leads/${leadId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${CRM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

### Python

```python
import requests

CRM_API_KEY = 'your-api-key'
CRM_BASE_URL = 'https://your-crm.example.com/api/v1'

headers = {
    'Authorization': f'Bearer {CRM_API_KEY}',
    'Content-Type': 'application/json'
}

# List leads
response = requests.get(f'{CRM_BASE_URL}/leads', headers=headers)
leads = response.json()

# Create lead
lead_data = {
    'name': 'Jane Smith',
    'email': 'jane@example.com',
    'company': 'Tech Corp',
    'value': 5000
}
response = requests.post(f'{CRM_BASE_URL}/leads', json=lead_data, headers=headers)
new_lead = response.json()
```

### cURL

```bash
# List leads
curl -H "Authorization: Bearer your-api-key" \
  https://your-crm.example.com/api/v1/leads

# Create lead
curl -X POST https://your-crm.example.com/api/v1/leads \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "company": "Tech Corp",
    "value": 5000
  }'

# Update lead
curl -X PATCH https://your-crm.example.com/api/v1/leads/lead-123 \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "qualified"
  }'
```

## Support

For API issues, contact support@checkmate.com or open an issue on GitHub.
