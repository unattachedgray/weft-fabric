---
name: code-quality
description: Comprehensive code quality skill covering code review, refactoring, coding standards, and best practices. Use when reviewing code, refactoring, applying standards, or improving code quality. Triggers on mentions of "review this code", "refactor", "clean up", "code quality", "best practices", "coding standards", or "make this better".
version: "2.0"
consolidated_from:
  - code-reviewer
  - code-refactoring
  - coding-standards
  - best-practices
---

# Code Quality

Systematic approach to code review, refactoring, and maintaining high-quality standards across all codebases.

## Overview

This skill combines code review practices, refactoring techniques, coding standards, and industry best practices into a unified workflow. Use it whenever you need to assess, improve, or maintain code quality.

**Core capabilities:**
- Comprehensive code review with automated quality checks
- Behavior-preserving refactoring operations
- Coding standards enforcement
- Performance and maintainability improvements

## When to Use

- Reviewing pull requests or code changes
- Refactoring messy or complex code
- Establishing coding standards for a project
- Detecting code smells and anti-patterns
- Improving code readability and maintainability
- Applying industry best practices
- Reducing technical debt

**Trigger phrases:** "review this code", "refactor", "clean up", "code quality check", "apply best practices", "coding standards", "make this cleaner", "code smell", "improve readability"

## Quick Reference

### Code Review Checklist

**Before reviewing:**
- [ ] Understand the context and purpose of changes
- [ ] Verify tests exist and pass
- [ ] Check for related code across the project

**During review:**
- [ ] **Functionality:** Does it work as intended?
- [ ] **Tests:** Are there adequate tests?
- [ ] **Readability:** Is the code self-documenting?
- [ ] **Maintainability:** Easy to change later?
- [ ] **Performance:** No obvious bottlenecks?
- [ ] **Security:** No vulnerabilities introduced?
- [ ] **Standards:** Follows project conventions?

### Refactoring Workflow

**Step 1: Understand** - Read code and dependencies thoroughly  
**Step 2: Diagnose** - Identify specific code smells  
**Step 3: Plan** - State which refactorings to apply  
**Step 4: Execute** - Apply one operation at a time, test after each  
**Step 5: Verify** - Run full test suite, show metrics  

**Rule:** Never change behavior during refactoring. If no tests exist, write characterization tests first.

### Common Refactoring Operations

**Extraction:**
- Extract Function - Pull code block into named function
- Extract Variable - Replace complex expression with named variable
- Extract Class/Module - Split large units into focused ones
- Extract Constant - Replace magic numbers with named constants

**Simplification:**
- Replace Nested Conditional with Guard Clauses - Flatten with early returns
- Decompose Conditional - Extract complex conditions into named functions
- Remove Flag Argument - Split function that behaves differently based on boolean
- Introduce Parameter Object - Group related parameters into single object

**Organization:**
- Rename - Change names to accurately describe purpose
- Move Function/Field - Relocate to where it logically belongs
- Inline Function/Variable - Remove trivial abstractions that add no clarity

## Core Patterns

### 1. Code Quality Principles

**Readability First**
```typescript
// ✅ GOOD: Clear, descriptive names
const marketSearchQuery = 'election'
const isUserAuthenticated = true
const fetchUserData = async (userId: string) => { }

// ❌ BAD: Unclear, abbreviated
const q = 'election'
const flag = true
const getData = async (id) => { }
```

**KISS - Keep It Simple**
- Simplest solution that works
- Avoid over-engineering
- Easy to understand > clever code

**DRY - Don't Repeat Yourself**
- Extract common logic into functions
- Create reusable components
- Share utilities across modules

**YAGNI - You Aren't Gonna Need It**
- Don't build features before they're needed
- Add complexity only when required
- Start simple, refactor when needed

### 2. Immutability Pattern (CRITICAL)

```typescript
// ✅ ALWAYS use spread operator for updates
const updatedUser = {
  ...user,
  name: 'New Name'
}

const updatedArray = [...items, newItem]

// ❌ NEVER mutate directly
user.name = 'New Name'  // BAD - mutation
items.push(newItem)     // BAD - mutation
```

### 3. Error Handling

```typescript
// ✅ GOOD: Comprehensive error handling
async function fetchData(url: string) {
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}

// ❌ BAD: No error handling
async function fetchData(url) {
  const response = await fetch(url)
  return response.json()  // Will fail silently
}
```

### 4. Type Safety

```typescript
// ✅ GOOD: Proper types
interface Market {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
  created_at: Date
}

function getMarket(id: string): Promise<Market> {
  // Implementation
}

// ❌ BAD: Using 'any'
function getMarket(id: any): Promise<any> {
  // Implementation
}
```

### 5. Async/Await Best Practices

```typescript
// ✅ GOOD: Parallel execution when possible
const [users, markets, stats] = await Promise.all([
  fetchUsers(),
  fetchMarkets(),
  fetchStats()
])

// ❌ BAD: Sequential when unnecessary
const users = await fetchUsers()
const markets = await fetchMarkets()
const stats = await fetchStats()
```

### 6. React Component Structure

```typescript
// ✅ GOOD: Typed functional component
interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary'
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}

// ❌ BAD: No types, unclear structure
export function Button(props) {
  return <button onClick={props.onClick}>{props.children}</button>
}
```

### 7. Input Validation

```typescript
import { z } from 'zod'

// ✅ GOOD: Schema validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150)
})

export async function createUser(input: unknown) {
  try {
    const validated = CreateUserSchema.parse(input)
    return await db.users.create(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    throw error
  }
}
```

### 8. API Design Standards

```typescript
// ✅ GOOD: Consistent response structure
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

// Success response
return NextResponse.json({
  success: true,
  data: markets,
  meta: { total: 100, page: 1, limit: 10 }
})

// Error response
return NextResponse.json({
  success: false,
  error: 'Invalid request'
}, { status: 400 })
```

## Common Mistakes

### 1. Long Functions
```typescript
// ❌ BAD: Function > 40-50 lines doing multiple things
function processMarketData() {
  // 100 lines of validation, transformation, and persistence
}

// ✅ GOOD: Split into focused functions
function processMarketData() {
  const validated = validateData()
  const transformed = transformData(validated)
  return saveData(transformed)
}
```

### 2. Deep Nesting
```typescript
// ❌ BAD: 3+ levels of nesting
if (user) {
  if (user.isAdmin) {
    if (market) {
      if (market.isActive) {
        // Do something
      }
    }
  }
}

// ✅ GOOD: Guard clauses and early returns
if (!user) return
if (!user.isAdmin) return
if (!market) return
if (!market.isActive) return

// Do something
```

### 3. Magic Numbers and Strings
```typescript
// ❌ BAD: Unexplained literals
if (retryCount > 3) { }
setTimeout(callback, 500)
const status = users.filter(u => u.role === 'admin')

// ✅ GOOD: Named constants
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
const ADMIN_ROLE = 'admin'

if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
const admins = users.filter(u => u.role === ADMIN_ROLE)
```

### 4. Unclear Variable Names
```typescript
// ❌ BAD: Ambiguous names
const data = fetchData()
const temp = process(data)
const result = transform(temp)
const handler = () => { }

// ✅ GOOD: Descriptive names
const userData = fetchUserData()
const normalizedUser = normalizeUserData(userData)
const enrichedUser = enrichUserProfile(normalizedUser)
const handleUserClick = () => { }
```

### 5. Copy-Paste Duplication
```typescript
// ❌ BAD: Repeated logic with minor variations
function getUserEmail(userId: string) {
  const user = await db.users.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  return user.email
}

function getUserName(userId: string) {
  const user = await db.users.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  return user.name
}

// ✅ GOOD: Extract common pattern
async function getUser(userId: string) {
  const user = await db.users.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  return user
}

function getUserEmail(userId: string) {
  const user = await getUser(userId)
  return user.email
}

function getUserName(userId: string) {
  const user = await getUser(userId)
  return user.name
}
```

### 6. Boolean Flag Arguments
```typescript
// ❌ BAD: Boolean changes function behavior
function renderUser(user: User, isAdmin: boolean) {
  if (isAdmin) {
    return <AdminUserView user={user} />
  }
  return <UserView user={user} />
}

// ✅ GOOD: Separate functions with clear names
function renderAdminUser(user: User) {
  return <AdminUserView user={user} />
}

function renderRegularUser(user: User) {
  return <UserView user={user} />
}
```

### 7. Premature Optimization
```typescript
// ❌ BAD: Over-engineering before profiling
const memoizedComplexCalculation = useMemo(() => {
  return x + y  // Trivial calculation
}, [x, y])

// ✅ GOOD: Keep simple until proven necessary
const sum = x + y
```

### 8. Comments That Lie
```typescript
// ❌ BAD: Comment doesn't match code
// Validates user input
const user = await db.users.create(input)  // Actually creates, doesn't validate

// ✅ GOOD: Code is self-documenting or comment explains WHY
// Create user record before validation to generate ID for audit log
const user = await db.users.create(input)
```

## Code Smell Checklist

**Structural:**
- [ ] Functions longer than ~40 lines
- [ ] Classes/modules doing more than one thing
- [ ] Deep nesting (3+ levels)
- [ ] Files longer than ~400 lines with mixed concerns
- [ ] Cyclomatic complexity above 10

**Duplication:**
- [ ] Copy-pasted logic with minor variations
- [ ] Repeated conditional patterns
- [ ] Parallel data structures that should be unified

**Naming and Clarity:**
- [ ] Ambiguous names (data, result, temp, val, handler, manager)
- [ ] Comments explaining "what" instead of "why"
- [ ] Boolean parameters that change behavior
- [ ] Magic numbers and strings

**Coupling:**
- [ ] Functions taking 5+ parameters
- [ ] Importing from deep internal paths
- [ ] Shotgun surgery - one change requires edits in many files

## Language-Specific Guidance

**TypeScript/JavaScript:**
- Prefer pure functions
- Use type narrowing to replace runtime checks
- Convert callbacks to async/await
- Use destructuring for parameter objects

**Python:**
- Use dataclasses or named tuples for parameter clusters
- Extract complex list comprehensions
- Leverage type hints to document contracts
- Use context managers for resource cleanup

**Rust:**
- Extract traits for shared behavior
- Use enum variants instead of boolean flags
- Convert nested match arms into separate functions
- Make illegal states unrepresentable via types

**Go:**
- Extract interfaces at consumer side
- Use table-driven tests
- Group related functions into receiver methods
- Return errors instead of panicking

## Performance Best Practices

### Memoization
```typescript
import { useMemo, useCallback } from 'react'

// ✅ Memoize expensive computations
const sortedMarkets = useMemo(() => {
  return markets.sort((a, b) => b.volume - a.volume)
}, [markets])

// ✅ Memoize callbacks
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])
```

### Lazy Loading
```typescript
import { lazy, Suspense } from 'react'

// ✅ Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))

export function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyChart />
    </Suspense>
  )
}
```

### Database Queries
```typescript
// ✅ Select only needed columns
const { data } = await supabase
  .from('markets')
  .select('id, name, status')
  .limit(10)

// ❌ Select everything unnecessarily
const { data } = await supabase
  .from('markets')
  .select('*')
```

## Testing Standards

### Test Structure (AAA Pattern)
```typescript
test('calculates similarity correctly', () => {
  // Arrange - Set up test data
  const vector1 = [1, 0, 0]
  const vector2 = [0, 1, 0]
  
  // Act - Execute the operation
  const similarity = calculateCosineSimilarity(vector1, vector2)
  
  // Assert - Verify the result
  expect(similarity).toBe(0)
})
```

### Test Naming
```typescript
// ✅ GOOD: Descriptive test names
test('returns empty array when no markets match query', () => { })
test('throws error when OpenAI API key is missing', () => { })
test('falls back to substring search when Redis unavailable', () => { })

// ❌ BAD: Vague test names
test('works', () => { })
test('test search', () => { })
```

## Refactoring Rules

1. **Never change behavior** - If you need to change behavior, that's a separate task
2. **Tests are the safety net** - If no tests exist, write characterization tests first
3. **Preserve the public API** - Internal restructuring is fine; changing signatures requires migration
4. **Smaller is better** - Ten small refactorings are safer than one large one
5. **Name things well** - If you can't name it clearly, you don't understand it yet
6. **Don't gold-plate** - Refactor to solve actual problems, stop when it's maintainable
7. **Respect project style** - Match existing conventions
8. **Leave breadcrumbs** - Note bugs discovered during refactoring but don't fix them in same pass

## Documentation Standards

### When to Comment
```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming API during outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

// Deliberately using mutation here for performance with large arrays
items.push(newItem)

// ❌ BAD: Stating the obvious
// Increment counter by 1
count++
```

### JSDoc for Public APIs
```typescript
/**
 * Searches markets using semantic similarity.
 * 
 * @param query - Natural language search query
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of markets sorted by similarity score
 * @throws {Error} If OpenAI API fails or Redis unavailable
 * 
 * @example
 * ```typescript
 * const results = await searchMarkets('election', 5)
 * console.log(results[0].name)
 * ```
 */
export async function searchMarkets(
  query: string,
  limit: number = 10
): Promise<Market[]> {
  // Implementation
}
```

## File Organization

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── markets/           # Feature pages
│   └── (auth)/           # Route groups
├── components/            # React components
│   ├── ui/               # Generic UI components
│   ├── forms/            # Form components
│   └── layouts/          # Layout components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configs
│   ├── api/             # API clients
│   ├── utils/           # Helper functions
│   └── constants/       # Constants
├── types/                # TypeScript types
└── styles/              # Global styles
```

**File Naming:**
- `components/Button.tsx` - PascalCase for components
- `hooks/useAuth.ts` - camelCase with 'use' prefix
- `lib/formatDate.ts` - camelCase for utilities
- `types/market.types.ts` - camelCase with .types suffix

---

**Tech Stack Support:** TypeScript, JavaScript, Python, Go, Rust, Swift, Kotlin, React, Next.js, Node.js

**Remember:** Code quality is not optional. Clear, maintainable code enables rapid development and confident refactoring.