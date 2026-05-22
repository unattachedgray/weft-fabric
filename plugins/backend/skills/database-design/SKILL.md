---
name: database-design
description: Complete database design and schema architecture. Covers SQL/NoSQL selection, normalization, indexing, migrations, ORMs, and performance optimization. Ensures data integrity, query performance, and maintainable schemas.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
license: MIT
---

# Database Design

Design production-ready database schemas with performance, integrity, and scalability built-in.

---

## Quick Start

Describe your data model and get a complete schema:

```
design a schema for e-commerce with users, products, orders
```

You'll receive:
- Normalized SQL schema (or NoSQL structure)
- Index strategy
- Foreign key constraints
- Migration scripts
- Performance considerations

---

## Core Principles

| Principle | Implementation | Why |
|-----------|----------------|-----|
| **Model the Domain** | Entity names reflect business concepts | UI changes, domain doesn't |
| **Data Integrity First** | Constraints at database level | Corruption is costly to fix |
| **Optimize for Access Patterns** | OLTP: normalized, OLAP: denormalized | Can't optimize for both |
| **Plan for Scale** | Index strategy + partitioning plan | Retrofitting is painful |
| **Ask, Don't Assume** | Clarify database/ORM preferences | Context determines the right tool |

---

## Decision Framework

### Database Selection

| Use Case | Database | Why |
|----------|----------|-----|
| Simple apps, embedded | SQLite | No server, single file |
| Serverless, edge | Turso, Neon | Auto-scaling, branching |
| Complex queries, ACID | PostgreSQL | Feature-rich, reliable |
| Document-oriented | MongoDB | Flexible schema |
| Time-series | InfluxDB, TimescaleDB | Optimized for time data |

**Before choosing, ask:**
- Deployment environment? (serverless, VPS, edge)
- Query patterns? (read-heavy, write-heavy, complex joins)
- Scale expectations? (millions of rows, TB of data)
- Development preferences? (SQL vs NoSQL)

### ORM Selection

| ORM | Strengths | Best For |
|-----|-----------|----------|
| **Drizzle** | Type-safe, SQL-like, lightweight | TypeScript projects, SQL lovers |
| **Prisma** | Auto-migration, great DX | Rapid prototyping, full-stack apps |
| **Kysely** | Type-safe query builder | SQL power users |
| **Raw SQL** | Full control | Performance-critical queries |

---

## Schema Design Process

```
Requirements Analysis
    ↓
Identify Entities & Relationships
    ↓
Normalize to 3NF (SQL) or Embed/Reference (NoSQL)
    ↓
Define Primary & Foreign Keys
    ↓
Add Constraints (UNIQUE, CHECK, NOT NULL)
    ↓
Plan Indexing Strategy
    ↓
Generate Migration Scripts
    ↓
Test & Optimize
```

---

## Normalization (SQL)

### Normal Forms Quick Reference

| Form | Rule | Violation Example |
|------|------|-------------------|
| **1NF** | Atomic values, no repeating groups | `tags = 'tag1,tag2,tag3'` |
| **2NF** | 1NF + no partial dependencies | customer_name in order_items |
| **3NF** | 2NF + no transitive dependencies | country derived from postal_code |

### When to Denormalize

| Scenario | Strategy | Trade-off |
|----------|----------|-----------|
| Read-heavy reporting | Pre-calculated aggregates | Write complexity |
| Expensive JOINs | Cached derived columns | Data duplication |
| Analytics dashboards | Materialized views | Storage cost |

**Rule:** Normalize by default. Denormalize only after measuring performance.

---

## Data Types

### Choosing the Right Type

| Data | Type | Example |
|------|------|---------|
| **Money** | DECIMAL(10,2) | Never FLOAT\! |
| **Email** | VARCHAR(255) | Standard max |
| **Phone** | VARCHAR(20) | International formats |
| **Country Code** | CHAR(2) | Fixed length |
| **Timestamps** | TIMESTAMP | Auto timezone |
| **Boolean** | BOOLEAN / TINYINT(1) | DB-specific |
| **Text Content** | TEXT | Articles, descriptions |
| **Age** | TINYINT | -128 to 127 |
| **IDs** | INT / BIGINT / UUID | Scale-dependent |

**Critical:** Always use DECIMAL for money. FLOAT causes rounding errors.

---

## Indexing Strategy

### When to Create Indexes

| Always Index | Reason |
|--------------|--------|
| Foreign keys | Speed up JOINs |
| WHERE columns | Speed up filtering |
| ORDER BY columns | Speed up sorting |
| Unique constraints | Enforce uniqueness |

### Index Types

| Type | Best For | Example Query |
|------|----------|---------------|
| **B-Tree** | Ranges, equality | `price > 100` |
| **Hash** | Exact matches | `email = 'x@y.com'` |
| **Full-text** | Text search | `MATCH AGAINST` |
| **Partial** | Subset of rows | `WHERE is_active = true` |

### Composite Index Rules

```sql
CREATE INDEX idx_customer_status ON orders(customer_id, status);

-- ✅ Uses index
SELECT * FROM orders WHERE customer_id = 123;
SELECT * FROM orders WHERE customer_id = 123 AND status = 'pending';

-- ❌ Does NOT use index
SELECT * FROM orders WHERE status = 'pending';
```

**Rule:** Most selective column first, or column queried alone most often.

---

## Constraints & Foreign Keys

### Foreign Key Deletion Strategies

| Strategy | Use When | Example |
|----------|----------|---------|
| **CASCADE** | Dependent data | Delete order → delete order_items |
| **RESTRICT** | Prevent accidents | Can't delete customer with orders |
| **SET NULL** | Optional relationships | Delete manager → employee.manager_id = NULL |

```sql
FOREIGN KEY (customer_id) REFERENCES customers(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE
```

### Other Constraints

```sql
-- Unique
email VARCHAR(255) UNIQUE NOT NULL

-- Check
price DECIMAL(10,2) CHECK (price >= 0)
discount INT CHECK (discount BETWEEN 0 AND 100)

-- Composite unique
UNIQUE (student_id, course_id)
```

---

## Relationship Patterns

### One-to-Many

```sql
CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Many-to-Many (Junction Table)

```sql
CREATE TABLE enrollments (
  student_id BIGINT REFERENCES students(id) ON DELETE CASCADE,
  course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, course_id)
);
```

### Self-Referencing

```sql
CREATE TABLE employees (
  id BIGINT PRIMARY KEY,
  manager_id BIGINT REFERENCES employees(id)
);
```

---

## Migrations

### Zero-Downtime Principles

| Practice | Why |
|----------|-----|
| Always reversible | Need to rollback |
| Backward compatible | Zero-downtime deploys |
| Separate schema & data | Reduce risk |
| Test on staging | Catch issues early |

### Adding a Column

```sql
-- Step 1: Add nullable
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Step 2: Deploy code writing to new column

-- Step 3: Backfill
UPDATE users SET phone = '' WHERE phone IS NULL;

-- Step 4: Make required
ALTER TABLE users MODIFY phone VARCHAR(20) NOT NULL;
```

### Migration Template

```sql
-- UP
BEGIN;
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
CREATE INDEX idx_users_phone ON users(phone);
COMMIT;

-- DOWN
BEGIN;
DROP INDEX idx_users_phone;
ALTER TABLE users DROP COLUMN phone;
COMMIT;
```

---

## NoSQL Design (MongoDB)

### Embedding vs Referencing

| Factor | Embed | Reference |
|--------|-------|-----------|
| Access pattern | Read together | Read separately |
| Relationship | 1:few | 1:many |
| Size | Small | Large |
| Updates | Rare | Frequent |

```json
// Embedded (orders with items)
{
  "_id": "order_123",
  "items": [
    { "product_id": "prod_789", "quantity": 2 }
  ]
}

// Referenced (large collections)
{
  "_id": "order_123",
  "item_ids": ["item_1", "item_2"]
}
```

---

## Performance Optimization

### Query Analysis

```sql
EXPLAIN SELECT * FROM orders
WHERE customer_id = 123 AND status = 'pending';
```

| Look For | Meaning | Action |
|----------|---------|--------|
| type: ALL | Full table scan | Add index |
| type: ref | Index used | Good |
| key: NULL | No index | Add index |
| rows: high | Many rows scanned | Optimize query |

### N+1 Query Problem

```python
# ❌ BAD: N+1 queries
orders = db.query("SELECT * FROM orders")
for order in orders:
    customer = db.query(f"SELECT * FROM customers WHERE id = {order.customer_id}")

# ✅ GOOD: Single JOIN
results = db.query("""
    SELECT orders.*, customers.name
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
""")
```

---

## Security Considerations

### SQL Injection Prevention

```python
# ❌ NEVER
query = f"SELECT * FROM users WHERE email = '{user_input}'"

# ✅ ALWAYS use parameterized queries
query = "SELECT * FROM users WHERE email = ?"
db.execute(query, [user_input])
```

### Additional Security

- Never store passwords in plain text (use bcrypt/argon2)
- Encrypt sensitive data at rest
- Use SSL/TLS for database connections
- Follow principle of least privilege for DB users
- Regular backups with encryption

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| VARCHAR(255) everywhere | Wastes storage | Size appropriately |
| FLOAT for money | Rounding errors | DECIMAL(10,2) |
| Missing FK constraints | Orphaned data | Always define FKs |
| No indexes on FKs | Slow JOINs | Index every FK |
| SELECT * in production | Fetches unnecessary data | Explicit columns |
| Non-reversible migrations | Can't rollback | Always write DOWN |
| String dates | Can't compare/sort | DATE/TIMESTAMP |
| Over-indexing | Slow writes | Only index what's queried |

---

## Verification Checklist

Before shipping:

- [ ] Every table has a primary key
- [ ] All relationships have FK constraints
- [ ] ON DELETE strategy defined for each FK
- [ ] Indexes on all foreign keys
- [ ] Indexes on frequently queried columns
- [ ] Appropriate data types (DECIMAL for money)
- [ ] NOT NULL on required fields
- [ ] UNIQUE constraints where needed
- [ ] CHECK constraints for validation
- [ ] created_at and updated_at timestamps
- [ ] Migration scripts are reversible
- [ ] Tested on staging with production-like data

---

## Related Files

For database-specific patterns, read:
- `database-selection.md` - Choosing the right database
- `orm-selection.md` - Drizzle vs Prisma vs Kysely
- `schema-design.md` - Deep normalization patterns
- `indexing.md` - Advanced indexing strategies
- `optimization.md` - Query performance tuning
- `migrations.md` - Safe schema evolution
