---
name: nextjs-development
description: Next.js App Router development with Server Components, data fetching, routing patterns, performance optimization, and Vercel deployment best practices
---

# Next.js Development

Expert Next.js development with App Router, Server Components, and modern patterns.

## Core Architecture

**App Router (Next.js 13+)**
- Use App Router for all new projects
- Server Components by default
- Client Components only when needed
- File-based routing with nested layouts

**Server vs Client Components**
```javascript
// app/components/ServerComponent.tsx
// Server Component (default)
async function ServerComponent() {
  const data = await fetchData(); // Direct database/API access
  return <div>{data}</div>;
}

// app/components/ClientComponent.tsx
'use client'; // Explicit client directive

import { useState } from 'react';

export function ClientComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**When to Use Client Components**
- Interactive event handlers (onClick, onChange)
- React hooks (useState, useEffect, useContext)
- Browser APIs (localStorage, window)
- Third-party libraries that use hooks

## File-Based Routing

**App Router Structure**
```
app/
├── layout.tsx           # Root layout
├── page.tsx             # Home page (/)
├── loading.tsx          # Loading UI
├── error.tsx            # Error UI
├── not-found.tsx        # 404 page
├── about/
│   └── page.tsx         # /about
├── blog/
│   ├── page.tsx         # /blog
│   ├── [slug]/
│   │   └── page.tsx     # /blog/[slug]
│   └── layout.tsx       # Blog layout
└── api/
    └── users/
        └── route.ts     # API route
```

**Dynamic Routes**
```javascript
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <article>Post: {params.slug}</article>;
}

// Generate static paths
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(post => ({ slug: post.slug }));
}
```

**Route Groups (Layout Without Path)**
```
app/
├── (marketing)/
│   ├── layout.tsx       # Marketing layout
│   ├── about/page.tsx   # /about
│   └── contact/page.tsx # /contact
└── (shop)/
    ├── layout.tsx       # Shop layout
    └── products/page.tsx # /products
```

## Data Fetching

**Server Components (Recommended)**
```javascript
// Direct async/await in Server Components
async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 } // ISR: revalidate every hour
  });

  return <div>{JSON.stringify(data)}</div>;
}
```

**Fetch Caching Options**
```javascript
// Static (cached indefinitely)
fetch(url, { cache: 'force-cache' });

// Dynamic (no cache)
fetch(url, { cache: 'no-store' });

// ISR (revalidate after time)
fetch(url, { next: { revalidate: 60 } });

// Revalidate on-demand
fetch(url, { next: { tags: ['products'] } });
// Then: revalidateTag('products')
```

**Server Actions (Forms & Mutations)**
```javascript
// app/actions.ts
'use server';

export async function createUser(formData: FormData) {
  const name = formData.get('name');
  const user = await db.users.create({ name });
  revalidatePath('/users');
  return user;
}

// app/page.tsx
import { createUser } from './actions';

export default function Page() {
  return (
    <form action={createUser}>
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Layouts & Templates

**Root Layout (Required)**
```javascript
// app/layout.tsx
export const metadata = {
  title: 'My App',
  description: 'App description'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

**Nested Layouts**
```javascript
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

**Loading States**
```javascript
// app/dashboard/loading.tsx
export default function Loading() {
  return <Skeleton />;
}
```

**Error Handling**
```javascript
// app/dashboard/error.tsx
'use client';

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

## Metadata & SEO

**Static Metadata**
```javascript
export const metadata = {
  title: 'Page Title',
  description: 'Page description',
  openGraph: {
    title: 'OG Title',
    description: 'OG Description',
    images: ['/og-image.png']
  }
};
```

**Dynamic Metadata**
```javascript
export async function generateMetadata({ params }) {
  const post = await getPost(params.id);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [post.image]
    }
  };
}
```

## API Routes

**Route Handlers**
```javascript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const users = await db.users.findMany();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await db.users.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
```

**Dynamic API Routes**
```javascript
// app/api/users/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.users.findUnique({
    where: { id: params.id }
  });
  return NextResponse.json(user);
}
```

## Image Optimization

**Next.js Image Component**
```javascript
import Image from 'next/image';

// Local images
import logo from './logo.png';
<Image src={logo} alt="Logo" />

// Remote images (requires domains config)
<Image
  src="https://example.com/photo.jpg"
  alt="Photo"
  width={500}
  height={300}
  priority // Load immediately (above fold)
/>

// Responsive
<Image
  src="/photo.jpg"
  alt="Photo"
  fill
  style={{ objectFit: 'cover' }}
/>
```

**Image Configuration**
```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['example.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  }
};
```

## Performance Optimization

**Streaming & Suspense**
```javascript
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </Suspense>
      <FastComponent />
    </div>
  );
}
```

**Partial Prerendering (Experimental)**
```javascript
// next.config.js
experimental: {
  ppr: true
}

// Page automatically splits into static/dynamic
export default function Page() {
  return (
    <div>
      <StaticHeader /> {/* Cached */}
      <Suspense fallback={<Skeleton />}>
        <DynamicContent /> {/* Streamed */}
      </Suspense>
    </div>
  );
}
```

**Code Splitting**
```javascript
import dynamic from 'next/dynamic';

// Lazy load component
const DynamicComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false // Client-side only
});
```

## Environment Variables

```javascript
// .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
DATABASE_URL=postgresql://...

// Access in code
// Client-side (NEXT_PUBLIC_ prefix required)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-side (any name)
const dbUrl = process.env.DATABASE_URL;
```

## Middleware

**Route Protection & Redirects**
```javascript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*'
};
```

## Deployment (Vercel)

**Automatic Optimization**
- Automatic HTTPS
- Global CDN
- Edge Functions
- Incremental Static Regeneration
- Image Optimization
- Preview deployments

**Configuration**
```javascript
// next.config.js
module.exports = {
  output: 'standalone', // Docker deployment
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true
};
```

**Environment Variables**
- Set in Vercel dashboard
- Separate for development/preview/production
- Auto-injected at build time

## Best Practices

**Server Components First**
- Default to Server Components
- Move client components to leaves of tree
- Pass server data as props to client components

**Static Generation Preference**
```javascript
// ISR instead of SSR when possible
export const revalidate = 3600; // Revalidate every hour
```

**Avoid Client-Side Fetching**
- Fetch in Server Components
- Pass data as props
- Use Server Actions for mutations

**Optimize Fonts**
```javascript
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

**Security**
- Use Server Actions instead of API routes for mutations
- Validate all inputs server-side
- Set secure headers in middleware
- Never expose secrets to client components

## File Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx
│   └── page.tsx
├── api/
│   └── webhook/route.ts
├── components/
│   ├── ui/
│   └── features/
├── lib/
│   ├── actions.ts
│   └── utils.ts
└── layout.tsx
```

## Quick Reference

- **Use** App Router for all new projects
- **Default** to Server Components
- **Add** 'use client' only when needed
- **Fetch** data in Server Components
- **Optimize** images with next/image
- **Configure** metadata for SEO
- **Stream** with Suspense boundaries
- **Validate** inputs in Server Actions
- **Cache** strategically with fetch options
- **Deploy** to Vercel for best experience
