---
name: security-review
description: Comprehensive security review covering authentication, authorization, input validation, secrets management, and vulnerability detection. Use when implementing auth, handling user input, creating APIs, working with secrets, or reviewing code for security issues. Critical security filter applied.
version: "2.0"
author: affaan-m
enhanced_from:
  - security-review
  - best-practices
  - coding-standards
  - code-reviewer
---

# Security Review

Comprehensive security review skill ensuring all code follows security best practices and identifies potential vulnerabilities before deployment.

## Overview

Security is non-negotiable. One vulnerability can compromise an entire platform. This skill provides systematic security checks, patterns, and anti-patterns across authentication, authorization, input validation, secrets management, and common attack vectors.

**Critical security filter applied:** This skill enforces strict security standards and will flag any potential vulnerabilities.

## When to Activate

**ALWAYS use this skill when:**
- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints
- Working with secrets, credentials, or API keys
- Implementing payment or financial features
- Storing or transmitting sensitive data
- Integrating third-party APIs
- Deploying to production
- Reviewing code that touches user data

**Trigger phrases:** "security review", "auth", "authentication", "API endpoint", "user input", "secrets", "deploy", "production", "security audit"

## Quick Reference

### Pre-Deployment Security Checklist

Before ANY production deployment, verify:

- [ ] **Secrets:** No hardcoded secrets, all in environment variables
- [ ] **Input Validation:** All user inputs validated with schemas
- [ ] **SQL Injection:** All queries use parameterized queries
- [ ] **XSS:** User-provided content sanitized
- [ ] **CSRF:** Protection enabled on state-changing operations
- [ ] **Authentication:** Proper token handling (httpOnly cookies)
- [ ] **Authorization:** Role/permission checks before sensitive operations
- [ ] **Rate Limiting:** Enabled on all public endpoints
- [ ] **HTTPS:** Enforced in production (HSTS enabled)
- [ ] **Security Headers:** CSP, X-Frame-Options, X-Content-Type-Options configured
- [ ] **Error Handling:** No sensitive data in error messages
- [ ] **Logging:** No passwords, tokens, or secrets in logs
- [ ] **Dependencies:** No known vulnerabilities (`npm audit` clean)
- [ ] **Row Level Security:** Enabled in database (if using Supabase/PostgreSQL)
- [ ] **CORS:** Properly configured, not wide open
- [ ] **File Uploads:** Size, type, and extension validation

### Security Testing Commands

```bash
# Check for dependency vulnerabilities
npm audit
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated

# Use in CI/CD
npm ci  # Instead of npm install
```

## Critical Security Patterns

### 1. Secrets Management

#### ❌ NEVER Do This
```typescript
// CRITICAL: Never hardcode secrets
const apiKey = "sk-proj-xxxxx"
const dbPassword = "password123"
const stripeKey = "sk_live_xxxxx"

// Never commit .env files with real secrets
// Never log secrets
console.log('API Key:', apiKey)
```

#### ✅ ALWAYS Do This
```typescript
// Use environment variables
const apiKey = process.env.OPENAI_API_KEY
const dbUrl = process.env.DATABASE_URL
const stripeKey = process.env.STRIPE_SECRET_KEY

// Verify secrets exist on startup
if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}

// Redact in logs
console.log('API Key:', apiKey ? '[REDACTED]' : 'missing')
```

**Verification steps:**
- [ ] No hardcoded API keys, tokens, passwords, or credentials
- [ ] All secrets in `.env.local` or environment variables
- [ ] `.env.local`, `.env`, `.env.production` in `.gitignore`
- [ ] No secrets in git history (`git log -p | grep -i "api_key"`)
- [ ] Production secrets stored in hosting platform (Vercel, Railway, etc.)
- [ ] Secrets rotated regularly
- [ ] Different secrets for dev/staging/production

### 2. Input Validation

**CRITICAL:** Always validate and sanitize ALL user input. Never trust client-side data.

#### Schema Validation
```typescript
import { z } from 'zod'

// ✅ Define strict validation schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'admin', 'moderator'])  // Whitelist allowed values
})

export async function createUser(input: unknown) {
  try {
    // Parse and validate
    const validated = CreateUserSchema.parse(input)
    
    // Safe to use validated data
    return await db.users.create(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Don't expose internal details in error
      return { 
        success: false, 
        error: 'Invalid input data'
      }
    }
    throw error
  }
}
```

#### File Upload Validation
```typescript
function validateFileUpload(file: File) {
  // 1. Size check (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new Error('File too large (max 5MB)')
  }
  
  // 2. MIME type check (whitelist)
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type')
  }
  
  // 3. Extension check (whitelist)
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('Invalid file extension')
  }
  
  // 4. File name sanitization
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  
  return { valid: true, sanitizedName }
}
```

**Verification steps:**
- [ ] All API endpoints validate input with schemas
- [ ] File uploads restricted by size, type, and extension
- [ ] No direct use of user input in queries or commands
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't leak implementation details
- [ ] Input sanitized before rendering (XSS prevention)

### 3. SQL Injection Prevention

#### ❌ NEVER Concatenate SQL
```typescript
// CRITICAL VULNERABILITY: SQL Injection
const email = userInput  // Could be: "'; DROP TABLE users; --"
const query = `SELECT * FROM users WHERE email = '${email}'`
await db.query(query)

// Attacker can execute arbitrary SQL
```

#### ✅ ALWAYS Use Parameterized Queries
```typescript
// Safe - parameterized query with Supabase
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', userEmail)  // Automatically escaped

// Safe - parameterized query with raw SQL
await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]  // Safely parameterized
)

// Safe - with Prisma ORM
const user = await prisma.user.findUnique({
  where: { email: userEmail }  // Type-safe and escaped
})
```

**Verification steps:**
- [ ] All database queries use parameterized queries
- [ ] No string concatenation or template literals in SQL
- [ ] ORM/query builder used correctly
- [ ] Dynamic table/column names validated against whitelist
- [ ] No raw SQL with user input

### 4. Authentication & Authorization

#### JWT Token Handling
```typescript
// ❌ WRONG: localStorage vulnerable to XSS
localStorage.setItem('token', token)

// ✅ CORRECT: httpOnly cookies (XSS-safe)
res.setHeader('Set-Cookie',
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600; Path=/`)
```

#### Authorization Checks
```typescript
// ✅ ALWAYS verify authorization BEFORE operations
export async function deleteUser(userId: string, requesterId: string) {
  // Step 1: Authenticate - verify requester exists
  const requester = await db.users.findUnique({
    where: { id: requesterId }
  })
  
  if (!requester) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Step 2: Authorize - verify requester has permission
  if (requester.role !== 'admin' && requester.id !== userId) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  
  // Step 3: Execute operation
  await db.users.delete({ where: { id: userId } })
  
  return NextResponse.json({ success: true })
}
```

#### Row Level Security (Supabase/PostgreSQL)
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own data
CREATE POLICY "Users view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own data
CREATE POLICY "Users update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Verification steps:**
- [ ] Tokens stored in httpOnly cookies (never localStorage)
- [ ] Authorization checks before ALL sensitive operations
- [ ] Row Level Security enabled on database tables
- [ ] Role-based access control (RBAC) implemented
- [ ] Session timeout configured appropriately
- [ ] Multi-factor authentication for admin accounts
- [ ] Password requirements enforced (length, complexity)
- [ ] Account lockout after failed login attempts

### 5. XSS Prevention

#### Sanitize User Content
```typescript
import DOMPurify from 'isomorphic-dompurify'

// ✅ ALWAYS sanitize user-provided HTML
function renderUserContent(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []  // No attributes allowed
  })
  
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}

// ❌ NEVER render unsanitized user content
function renderUserContent(html: string) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />  // XSS vulnerability
}
```

#### Content Security Policy
```typescript
// next.config.js - Strict CSP
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'nonce-{NONCE}';
      style-src 'self' 'nonce-{NONCE}';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' https://api.example.com;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
]
```

**Verification steps:**
- [ ] User-provided HTML sanitized with DOMPurify
- [ ] CSP headers configured and tested
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No `eval()` or `new Function()` with user input
- [ ] React's automatic XSS protection not bypassed

### 6. CSRF Protection

#### CSRF Tokens
```typescript
import { csrf } from '@/lib/csrf'

// Generate token (server-side)
const token = csrf.generate(sessionId)

// Include in form
<form method="POST">
  <input type="hidden" name="csrf_token" value={token} />
</form>

// Verify token (server-side)
export async function POST(request: Request) {
  const formData = await request.formData()
  const token = formData.get('csrf_token')
  
  if (!csrf.verify(token, sessionId)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }
  
  // Process request
}
```

#### SameSite Cookies
```typescript
// ✅ Always use SameSite=Strict for session cookies
res.setHeader('Set-Cookie',
  `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/`)
```

**Verification steps:**
- [ ] CSRF tokens on all state-changing operations
- [ ] SameSite=Strict on all session cookies
- [ ] Double-submit cookie pattern implemented
- [ ] Custom request headers for AJAX requests

### 7. Rate Limiting

#### API Rate Limiting
```typescript
import rateLimit from 'express-rate-limit'

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

// Aggressive rate limiting for expensive operations
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute
  message: 'Too many search requests'
})

// Very strict for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts
  message: 'Too many login attempts, please try again later'
})

// Apply to routes
app.use('/api/', generalLimiter)
app.use('/api/search', searchLimiter)
app.use('/api/auth/login', authLimiter)
```

**Verification steps:**
- [ ] Rate limiting on ALL public API endpoints
- [ ] Stricter limits on expensive operations (search, AI, etc.)
- [ ] Very strict limits on authentication endpoints
- [ ] IP-based rate limiting
- [ ] User-based rate limiting (for authenticated endpoints)
- [ ] Rate limit headers returned in response

### 8. Sensitive Data Exposure

#### Logging Best Practices
```typescript
// ❌ WRONG: Logging sensitive data
console.log('User login:', { email, password })
console.log('Payment:', { cardNumber, cvv, amount })
console.log('Database URL:', process.env.DATABASE_URL)

// ✅ CORRECT: Redact sensitive data
console.log('User login:', { 
  email, 
  userId,
  // password is never logged
})

console.log('Payment:', { 
  last4: card.last4, 
  userId,
  amount 
  // cardNumber and cvv never logged
})

console.log('Database:', {
  host: new URL(process.env.DATABASE_URL).host,
  // full connection string never logged
})
```

#### Error Messages
```typescript
// ❌ WRONG: Exposing internal details
catch (error) {
  return NextResponse.json(
    { 
      error: error.message,  // May leak implementation details
      stack: error.stack,    // Exposes code structure
      query: sqlQuery        // May contain sensitive data
    },
    { status: 500 }
  )
}

// ✅ CORRECT: Generic errors to users, detailed logs internally
catch (error) {
  // Log detailed error internally
  console.error('Internal error:', {
    message: error.message,
    stack: error.stack,
    userId: request.userId,
    timestamp: new Date().toISOString()
  })
  
  // Send generic error to user
  return NextResponse.json(
    { error: 'An error occurred. Please try again later.' },
    { status: 500 }
  )
}
```

**Verification steps:**
- [ ] No passwords, tokens, or secrets in logs
- [ ] Error messages generic for end users
- [ ] Detailed errors only in server logs (not sent to client)
- [ ] No stack traces exposed to users in production
- [ ] API responses don't leak internal structure
- [ ] Database errors sanitized

### 9. HTTPS and Transport Security

#### Enforce HTTPS
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ]
  }
}

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
  return NextResponse.redirect(`https://${req.headers.host}${req.url}`, 301)
}
```

**Verification steps:**
- [ ] HTTPS enforced in production
- [ ] HSTS header configured
- [ ] No mixed content (HTTP resources on HTTPS pages)
- [ ] TLS 1.2 or higher
- [ ] Valid SSL certificate

### 10. Dependency Security

#### Regular Security Audits
```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Fix with breaking changes (review first)
npm audit fix --force

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

#### Lock Files
```bash
# ALWAYS commit lock files for reproducible builds
git add package-lock.json

# Use 'npm ci' in CI/CD (faster, stricter)
npm ci  # Instead of 'npm install'
```

**Verification steps:**
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (`npm audit` returns 0 vulnerabilities)
- [ ] Lock files (package-lock.json, yarn.lock) committed
- [ ] Dependabot or Renovate enabled on GitHub
- [ ] Regular security updates scheduled
- [ ] Dependencies from trusted sources only

## Security Testing

### Automated Security Tests
```typescript
describe('Security Tests', () => {
  // Authentication tests
  test('requires authentication for protected routes', async () => {
    const response = await fetch('/api/protected')
    expect(response.status).toBe(401)
  })
  
  // Authorization tests
  test('requires admin role for admin operations', async () => {
    const response = await fetch('/api/admin/delete-user', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
    expect(response.status).toBe(403)
  })
  
  // Input validation tests
  test('rejects invalid email format', async () => {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' })
    })
    expect(response.status).toBe(400)
  })
  
  // SQL injection tests
  test('safely handles malicious SQL input', async () => {
    const response = await fetch('/api/users?email=' + encodeURIComponent("'; DROP TABLE users; --"))
    expect(response.status).not.toBe(500)
    // Verify users table still exists
    const users = await db.users.count()
    expect(users).toBeGreaterThan(0)
  })
  
  // XSS tests
  test('sanitizes HTML in user content', async () => {
    const maliciousContent = '<script>alert("XSS")</script>'
    const sanitized = sanitizeHtml(maliciousContent)
    expect(sanitized).not.toContain('<script>')
  })
  
  // Rate limiting tests
  test('enforces rate limits', async () => {
    const requests = Array(101).fill(null).map(() =>
      fetch('/api/endpoint')
    )
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    expect(rateLimited.length).toBeGreaterThan(0)
  })
  
  // CSRF tests
  test('rejects requests without CSRF token', async () => {
    const response = await fetch('/api/update-profile', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Name' })
      // Missing CSRF token
    })
    expect(response.status).toBe(403)
  })
})
```

## Common Security Anti-Patterns

### 1. Trusting Client-Side Validation
```typescript
// ❌ WRONG: Only client-side validation
// Client-side can be bypassed
<form onSubmit={validateForm}>
  <input type="email" required />
</form>

// ✅ CORRECT: Always validate server-side
export async function POST(request: Request) {
  const data = await request.json()
  
  // Server-side validation (critical)
  const validated = UserSchema.parse(data)
  
  // Proceed with validated data
}
```

### 2. Weak Password Requirements
```typescript
// ❌ WRONG: Weak password policy
const isValidPassword = (pwd: string) => pwd.length >= 6

// ✅ CORRECT: Strong password requirements
const isValidPassword = (pwd: string) => {
  return (
    pwd.length >= 12 &&
    /[A-Z]/.test(pwd) &&  // Uppercase
    /[a-z]/.test(pwd) &&  // Lowercase
    /[0-9]/.test(pwd) &&  // Number
    /[^A-Za-z0-9]/.test(pwd)  // Special character
  )
}
```

### 3. Information Disclosure
```typescript
// ❌ WRONG: Different errors reveal user existence
if (!user) {
  return { error: 'User not found' }
}
if (!passwordMatch) {
  return { error: 'Incorrect password' }
}

// ✅ CORRECT: Generic error prevents user enumeration
if (!user || !passwordMatch) {
  return { error: 'Invalid email or password' }
}
```

### 4. Insecure Direct Object References
```typescript
// ❌ WRONG: No authorization check
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await db.users.findUnique({ where: { id: params.id } })
  return NextResponse.json(user)  // Anyone can view any user
}

// ✅ CORRECT: Verify ownership
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession(request)
  
  if (session.userId !== params.id && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const user = await db.users.findUnique({ where: { id: params.id } })
  return NextResponse.json(user)
}
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security](https://nextjs.org/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [Web Security Academy](https://portswigger.net/web-security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**CRITICAL REMINDER:** Security is NOT optional. One vulnerability can compromise the entire platform. When in doubt, err on the side of caution. If you're unsure whether something is secure, flag it for review.