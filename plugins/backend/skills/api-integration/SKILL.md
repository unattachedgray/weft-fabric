---
name: api-integration
description: Expert skill for integrating third-party APIs and documenting APIs. Use when integrating external services (Stripe, Twilio, SendGrid), building API clients, implementing OAuth/JWT authentication, handling webhooks, managing rate limits and retries, or generating comprehensive API documentation with examples and best practices.
---

# API Integration

Complete guide for integrating external APIs and creating professional API documentation.

## Overview

This skill covers:
- **API Integration** - REST, GraphQL, webhooks
- **Authentication** - OAuth 2.0, API keys, JWT
- **Error Handling** - Retries, circuit breakers, timeouts
- **Rate Limiting** - Client-side throttling, backoff strategies
- **Documentation** - OpenAPI/Swagger, examples, best practices
- **Testing** - Postman collections, integration tests

## When to Use This Skill

Use this skill when:
- Integrating third-party services (Stripe, Twilio, SendGrid, etc.)
- Building API client libraries
- Implementing OAuth flows or API key authentication
- Setting up webhooks and event handlers
- Handling rate limits and retries
- Generating API documentation
- Debugging API integration issues

---

## Quick Reference

### Integration Checklist

- [ ] Store API keys in environment variables
- [ ] Implement retry logic with exponential backoff
- [ ] Handle rate limiting gracefully
- [ ] Validate webhook signatures
- [ ] Transform responses to internal models
- [ ] Log all API interactions
- [ ] Set appropriate timeouts
- [ ] Document all endpoints

### Common API Patterns

```typescript
// Basic API client structure
class APIClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
  }

  async request(method, endpoint, data = null) {
    // Implementation
  }
}
```

---

## API Integration Patterns

### 1. Authentication & Security

**API Key Management:**
```typescript
// ✅ GOOD: Environment variables
const apiClient = new APIClient({
  apiKey: process.env.SERVICE_API_KEY,
  baseURL: process.env.SERVICE_BASE_URL
});

// ❌ BAD: Hardcoded keys
const apiClient = new APIClient({
  apiKey: 'sk_live_abc123...',
  baseURL: 'https://api.example.com'
});
```

**OAuth 2.0 Flow:**
```typescript
class OAuth2Client {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes;
  }

  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      response_type: 'code'
    });
    return `https://oauth.example.com/authorize?${params}`;
  }

  async exchangeCode(code: string) {
    const response = await fetch('https://oauth.example.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      })
    });

    return response.json();
  }
}
```

**JWT Validation:**
```typescript
import jwt from 'jsonwebtoken';

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch (error) {
    throw new ApiError(401, 'Invalid token');
  }
}
```

### 2. Request/Response Handling

**Standardized Request Structure:**
```typescript
async function makeRequest(endpoint: string, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': 'MyApp/1.0.0'
  };

  const response = await fetch(`${baseURL}${endpoint}`, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers }
  });

  if (!response.ok) {
    throw new APIError(response.status, await response.json());
  }

  return response.json();
}
```

**Response Transformation:**
```typescript
class APIClient {
  async getUser(userId: string) {
    const raw = await this.request(`/users/${userId}`);

    // Transform external API format to internal model
    return {
      id: raw.user_id,
      email: raw.email_address,
      name: `${raw.first_name} ${raw.last_name}`,
      createdAt: new Date(raw.created_timestamp)
    };
  }
}
```

### 3. Error Handling

**Structured Error Types:**
```typescript
class APIError extends Error {
  constructor(
    public status: number,
    public body: any
  ) {
    super(`API Error: ${status}`);
    this.isAPIError = true;
  }

  isRateLimited() {
    return this.status === 429;
  }

  isUnauthorized() {
    return this.status === 401;
  }

  isServerError() {
    return this.status >= 500;
  }
}
```

**Retry Logic with Exponential Backoff:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (!error.isAPIError || !error.isServerError()) {
        throw error; // Don't retry client errors
      }

      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await sleep(delay);
    }
  }
}
```

### 4. Rate Limiting

**Client-Side Rate Limiter:**
```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await sleep(waitTime);
      return this.acquire();
    }

    this.requests.push(now);
  }
}

const limiter = new RateLimiter(100, 60000); // 100 requests per minute

async function rateLimitedRequest(endpoint: string, options: any) {
  await limiter.acquire();
  return makeRequest(endpoint, options);
}
```

### 5. Webhook Handling

**Webhook Verification:**
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!verifyWebhookSignature(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  handleWebhookEvent(event);

  res.status(200).send('Received');
});
```

### 6. Pagination Handling

```typescript
async function* fetchAllPages(endpoint: string, pageSize = 100) {
  let cursor = null;

  do {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      ...(cursor && { cursor })
    });

    const response = await apiClient.request('GET', `${endpoint}?${params}`);

    yield response.data;

    cursor = response.pagination?.next_cursor;
  } while (cursor);
}

// Usage
for await (const page of fetchAllPages('/users')) {
  processUsers(page);
}
```

### 7. Complete API Client Pattern

```typescript
class ServiceAPIClient {
  constructor(config: APIConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 30000;
  }

  async request(method: string, endpoint: string, data = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.timeout
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await retryWithBackoff(() =>
      fetch(`${this.baseURL}${endpoint}`, options)
    );

    return response.json();
  }

  // Resource methods
  async getResource(id: string) {
    return this.request('GET', `/resources/${id}`);
  }

  async createResource(data: any) {
    return this.request('POST', '/resources', data);
  }

  async updateResource(id: string, data: any) {
    return this.request('PUT', `/resources/${id}`, data);
  }

  async deleteResource(id: string) {
    return this.request('DELETE', `/resources/${id}`);
  }
}
```

---

## API Documentation

### Documentation Structure

1. **Introduction** - What the API does, base URL, version
2. **Authentication** - How to authenticate, token management
3. **Quick Start** - Simple example to get started
4. **Endpoints** - Full details for each endpoint
5. **Data Models** - Schema definitions and validation
6. **Error Handling** - Error codes and troubleshooting
7. **Rate Limiting** - Limits and handling
8. **Changelog** - Version history and breaking changes

### Endpoint Documentation Template

```markdown
## Create User

Creates a new user account.

**Endpoint:** `POST /api/v1/users`

**Authentication:** Required (Bearer token)

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",      // Required: Valid email
  "password": "SecurePass123!",     // Required: Min 8 chars
  "name": "John Doe",               // Required: 2-50 characters
  "role": "user"                    // Optional: Default "user"
}
\`\`\`

**Success Response (201 Created):**
\`\`\`json
{
  "id": "usr_1234567890",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "createdAt": "2026-01-20T10:30:00Z"
}
\`\`\`

**Error Responses:**

- `400 Bad Request` - Invalid input
- `409 Conflict` - Email already exists
- `401 Unauthorized` - Invalid/missing token

**Example (cURL):**
\`\`\`bash
curl -X POST https://api.example.com/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!","name":"John Doe"}'
\`\`\`

**Example (JavaScript):**
\`\`\`javascript
const response = await fetch('https://api.example.com/api/v1/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    name: 'John Doe'
  })
});

const user = await response.json();
\`\`\`
```

---

## Common Integration Examples

### Stripe Payment Processing

```typescript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent(amount: number, currency = 'usd') {
  return await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true }
  });
}
```

### SendGrid Email Sending

```typescript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  await sgMail.send({
    to,
    from: process.env.FROM_EMAIL,
    subject,
    html
  });
}
```

### Twilio SMS

```typescript
const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(to: string, body: string) {
  await twilio.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
    body
  });
}
```

---

## Best Practices

### ✅ Do This

- Store API keys in environment variables
- Use HTTPS for all API calls
- Verify webhook signatures
- Implement retry logic with exponential backoff
- Handle rate limits gracefully
- Set appropriate timeouts
- Transform responses to internal models
- Log all API interactions
- Cache responses when appropriate
- Provide code examples in multiple languages
- Document all error codes
- Include realistic example data
- Test all code examples

### ❌ Don't Do This

- Hardcode API keys
- Skip error handling
- Ignore rate limits
- Use blocking operations
- Log sensitive data
- Skip webhook verification
- Use vague documentation
- Leave examples broken
- Forget to version APIs
- Skip authentication documentation

---

## Troubleshooting

### Authentication Issues
- Verify API keys are correctly set
- Check token expiration
- Ensure proper OAuth scopes
- Validate signature generation

### Rate Limiting
- Implement client-side rate limiting
- Use batch endpoints when available
- Spread requests over time
- Consider upgrading API tier

### Timeout Errors
- Increase timeout values
- Implement request cancellation
- Use streaming for large payloads
- Check network connectivity

### Webhook Failures
- Verify signature validation
- Check endpoint accessibility
- Implement idempotency
- Return 200 quickly

---

**Remember:** API integration is about reliability and security. Always validate inputs, handle errors gracefully, implement retries, and document everything clearly.
