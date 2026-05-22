---
name: backend-development
description: Comprehensive backend development skill for Node.js/Express/TypeScript microservices. Use when building APIs, implementing layered architecture (routes → controllers → services → repositories), handling database operations with Prisma, error tracking with Sentry, validation with Zod, and following production-ready patterns for scalable backend systems.
---

# Backend Development

Complete guide for building production-ready backend systems with Node.js, Express, TypeScript, and modern best practices.

## Overview

This skill covers end-to-end backend development including:
- **Layered Architecture** - Routes, controllers, services, repositories
- **API Design** - RESTful patterns, GraphQL, versioning
- **Database** - Prisma ORM, query optimization, transactions
- **Authentication** - JWT, OAuth 2.0, session management
- **Error Handling** - Sentry integration, structured errors
- **Performance** - Caching, rate limiting, monitoring

## When to Use This Skill

Use automatically when:
- Creating or modifying API endpoints
- Building controllers, services, or repositories
- Implementing middleware (auth, validation, error handling)
- Database operations and migrations
- Error tracking and monitoring setup
- Backend refactoring or optimization

---

## Quick Reference

### New Feature Checklist

- [ ] Route definition with clean delegation
- [ ] Controller extending BaseController
- [ ] Service with business logic and DI
- [ ] Repository for complex data access
- [ ] Zod validation schema
- [ ] Sentry error tracking
- [ ] Unit and integration tests
- [ ] Environment config via unifiedConfig

### Common Imports

```typescript
// Express
import express, { Request, Response, NextFunction, Router } from 'express';

// Validation
import { z } from 'zod';

// Database
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// Sentry
import * as Sentry from '@sentry/node';

// Config (never use process.env directly)
import { config } from './config/unifiedConfig';
```

### HTTP Status Codes

| Code | Use Case | Example |
|------|----------|---------|
| 200 | Success | Data retrieved |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Unexpected error |

---

## Core Patterns

### 1. Layered Architecture

```
HTTP Request
    ↓
Routes (routing only)
    ↓
Controllers (request handling)
    ↓
Services (business logic)
    ↓
Repositories (data access)
    ↓
Database (Prisma)
```

**Key Principle:** Each layer has ONE responsibility.

**Routes - Only Route:**
```typescript
// ✅ GOOD: Delegate to controller
router.post('/users', (req, res) => controller.createUser(req, res));

// ❌ BAD: Business logic in routes
router.post('/users', async (req, res) => {
  // 200 lines of logic here
});
```

**Controllers - Handle Requests:**
```typescript
export class UserController extends BaseController {
  constructor(private userService: UserService) {
    super();
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const validated = createUserSchema.parse(req.body);
      const user = await this.userService.createUser(validated);
      this.handleSuccess(res, user, 201);
    } catch (error) {
      this.handleError(error, res, 'createUser');
    }
  }
}
```

**Services - Business Logic:**
```typescript
export class UserService {
  constructor(private userRepo: UserRepository) {}

  async createUser(data: CreateUserDto): Promise<User> {
    // Validate business rules
    const exists = await this.userRepo.findByEmail(data.email);
    if (exists) {
      throw new ApiError(409, 'Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    return this.userRepo.create({
      ...data,
      password: hashedPassword
    });
  }
}
```

**Repositories - Data Access:**
```typescript
export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data
    });
  }
}
```

### 2. API Design Patterns

**RESTful Resource Structure:**
```typescript
// ✅ Resource-based URLs
GET    /api/v1/users              // List users
GET    /api/v1/users/:id          // Get user
POST   /api/v1/users              // Create user
PUT    /api/v1/users/:id          // Replace user
PATCH  /api/v1/users/:id          // Update user
DELETE /api/v1/users/:id          // Delete user

// Query parameters for filtering/sorting/pagination
GET /api/v1/users?role=admin&sort=createdAt&limit=20&offset=40
```

**Repository Pattern:**
```typescript
interface MarketRepository {
  findAll(filters?: MarketFilters): Promise<Market[]>
  findById(id: string): Promise<Market | null>
  create(data: CreateMarketDto): Promise<Market>
  update(id: string, data: UpdateMarketDto): Promise<Market>
  delete(id: string): Promise<void>
}

class SupabaseMarketRepository implements MarketRepository {
  async findAll(filters?: MarketFilters): Promise<Market[]> {
    let query = supabase.from('markets').select('*')

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  }
}
```

**Service Layer with DI:**
```typescript
class MarketService {
  constructor(private marketRepo: MarketRepository) {}

  async searchMarkets(query: string, limit = 10): Promise<Market[]> {
    const embedding = await generateEmbedding(query)
    const results = await this.vectorSearch(embedding, limit)
    const markets = await this.marketRepo.findByIds(results.map(r => r.id))

    return markets.sort((a, b) => {
      const scoreA = results.find(r => r.id === a.id)?.score || 0
      const scoreB = results.find(r => r.id === b.id)?.score || 0
      return scoreB - scoreA
    })
  }
}
```

### 3. Input Validation with Zod

```typescript
import { z } from 'zod';

// Define schema
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(2).max(50),
  role: z.enum(['user', 'admin']).default('user')
});

type CreateUserDto = z.infer<typeof createUserSchema>;

// Use in controller
const validated = createUserSchema.parse(req.body);
```

### 4. Error Handling

**Structured Error Classes:**
```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Usage
if (!user) {
  throw new ApiError(404, 'User not found');
}
```

**Sentry Integration:**
```typescript
// instrument.ts (FIRST IMPORT in server)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: config.sentry.dsn,
  environment: config.env
});

// In error handlers
try {
  await operation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

**Centralized Error Handler:**
```typescript
export function errorHandler(error: unknown, req: Request): Response {
  if (error instanceof ApiError) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: error.statusCode });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      details: error.errors
    }, { status: 400 });
  }

  Sentry.captureException(error);

  return NextResponse.json({
    success: false,
    error: 'Internal server error'
  }, { status: 500 });
}
```

**Retry with Exponential Backoff:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### 5. Database Optimization

**Query Optimization:**
```typescript
// ✅ GOOD: Select only needed columns
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true
  },
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
  take: 10
});

// ❌ BAD: Select everything
const users = await prisma.user.findMany();
```

**N+1 Query Prevention:**
```typescript
// ❌ BAD: N+1 queries
const posts = await prisma.post.findMany();
for (const post of posts) {
  post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
}

// ✅ GOOD: Single query with include
const posts = await prisma.post.findMany({
  include: { author: true }
});
```

**Transactions:**
```typescript
async function createMarketWithPosition(
  marketData: CreateMarketDto,
  positionData: CreatePositionDto
) {
  return await prisma.$transaction(async (tx) => {
    const market = await tx.market.create({ data: marketData });
    const position = await tx.position.create({
      data: { ...positionData, marketId: market.id }
    });
    return { market, position };
  });
}
```

### 6. Caching Strategies

**Redis Cache Layer:**
```typescript
class CachedUserRepository implements UserRepository {
  constructor(
    private baseRepo: UserRepository,
    private redis: RedisClient
  ) {}

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Cache miss
    const user = await this.baseRepo.findById(id);

    if (user) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(user));
    }

    return user;
  }

  async invalidateCache(id: string): Promise<void> {
    await this.redis.del(`user:${id}`);
  }
}
```

### 7. Rate Limiting

```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();

  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    const recentRequests = requests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return true;
  }
}

// Middleware
export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const allowed = await limiter.checkLimit(ip, 100, 60000); // 100 req/min

  if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  next();
}
```

### 8. Authentication & Authorization

**JWT Validation:**
```typescript
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch (error) {
    throw new ApiError(401, 'Invalid token');
  }
}

export async function requireAuth(req: Request): Promise<JWTPayload> {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Missing authorization token');
  }

  return verifyToken(token);
}
```

**Role-Based Access Control:**
```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin';

const rolePermissions: Record<string, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin'],
  moderator: ['read', 'write', 'delete'],
  user: ['read', 'write']
};

export function hasPermission(user: JWTPayload, permission: Permission): boolean {
  return rolePermissions[user.role]?.includes(permission) || false;
}

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await requireAuth(req);

    if (!hasPermission(user, permission)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    req.user = user;
    next();
  };
}
```

### 9. Middleware Patterns

**Authentication Middleware:**
```typescript
export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await verifyToken(token);
      req.user = user;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
```

**Structured Logging:**
```typescript
interface LogContext {
  userId?: string;
  requestId?: string;
  method?: string;
  path?: string;
}

class Logger {
  log(level: 'info' | 'warn' | 'error', message: string, context?: LogContext) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    console.log(JSON.stringify(entry));
  }

  error(message: string, error: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error.message,
      stack: error.stack
    });
  }
}
```

---

## Common Mistakes

### ❌ Don't Do This

- Business logic in routes
- Direct `process.env` usage (use `unifiedConfig`)
- Missing error handling
- No input validation
- Direct Prisma calls everywhere (use repositories)
- `console.log` instead of Sentry
- Selecting all columns (`SELECT *`)
- N+1 query problems
- No rate limiting
- Hardcoded secrets

### ✅ Do This

- Delegate to controllers from routes
- Use `unifiedConfig` for all configuration
- Wrap all operations in try-catch with Sentry
- Validate all input with Zod
- Use repository pattern for data access
- Send errors to Sentry
- Select only needed columns
- Use joins/includes to prevent N+1
- Implement rate limiting
- Store secrets in environment variables

---

## Directory Structure

```
service/src/
├── config/              # UnifiedConfig
│   └── unifiedConfig.ts
├── controllers/         # Request handlers (PascalCase)
│   └── UserController.ts
├── services/            # Business logic (camelCase)
│   └── userService.ts
├── repositories/        # Data access (PascalCase + Repository)
│   └── UserRepository.ts
├── routes/              # Route definitions (camelCase + Routes)
│   └── userRoutes.ts
├── middleware/          # Express middleware
│   ├── auth.ts
│   └── errorBoundary.ts
├── types/               # TypeScript types
├── validators/          # Zod schemas
├── utils/               # Utilities
├── tests/               # Tests
├── instrument.ts        # Sentry (FIRST IMPORT)
├── app.ts               # Express setup
└── server.ts            # HTTP server
```

---

## Best Practices

### Code Quality
- Follow layered architecture strictly
- Write comprehensive tests
- Document complex business logic
- Use TypeScript for type safety

### Performance
- Cache frequently accessed data
- Optimize database queries
- Use pagination for large datasets
- Monitor performance metrics

### Security
- Validate all inputs with Zod
- Use parameterized queries
- Implement proper authentication
- Keep dependencies updated
- Never log sensitive data

### Maintainability
- Use consistent naming conventions
- Keep functions small and focused
- Add helpful error messages
- Review code regularly

---

### Durable Workflows

For long-running business processes (order fulfillment, payment processing, multi-step onboarding, saga patterns across microservices), consider [Temporal](https://github.com/temporalio/temporal):

- **When to use:** Workflows spanning minutes to days with multiple steps that must complete reliably, operations requiring compensation/rollback on failure (saga pattern), processes with human-in-the-loop approval gates
- **When to skip:** Simple request-response APIs, short background jobs (use BullMQ/Redis queues), CRUD operations
- **Pattern:** Each workflow step is an "activity" with its own retry policy and timeout. The workflow function reads like normal async code but survives process crashes — Temporal replays the workflow from its event history.

---

**Remember:** Backend development is about building reliable, scalable systems. Follow these patterns, validate everything, handle errors properly, and monitor your application in production.
