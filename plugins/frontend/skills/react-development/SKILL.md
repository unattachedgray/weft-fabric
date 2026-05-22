---
name: react-development
description: React development with modern hooks, TypeScript patterns, Server Components, event handling, state management, and routing (React Router, TanStack)
---

# React Development

Expert React development with modern patterns, hooks, and best practices.

## Core Principles

**Component Architecture**
- Use functional components with hooks exclusively
- Keep components small and focused (single responsibility)
- Composition over inheritance
- Extract reusable logic into custom hooks
- Co-locate related code (components, styles, tests)

**State Management**
- Use built-in React state for local UI state
- Context API for shared application state
- Consider Zustand/Jotai for complex global state
- Keep state as close to where it's used as possible
- Lift state only when necessary

**Performance**
- Use React.memo() for expensive pure components
- useMemo() for expensive calculations
- useCallback() for function references passed to children
- Lazy load routes and heavy components
- Virtualize long lists (react-window)

## Essential Hooks

**useState** - Local component state
```javascript
const [count, setCount] = useState(0);
const [user, setUser] = useState({ name: '', email: '' });

// Functional updates for derived state
setCount(prev => prev + 1);
```

**useEffect** - Side effects and lifecycle
```javascript
useEffect(() => {
  // Run on mount and when deps change
  fetchData();

  // Cleanup function
  return () => cleanup();
}, [dependency]);

// Empty array = run once on mount
useEffect(() => {
  initializeApp();
}, []);
```

**useCallback** - Memoize functions
```javascript
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

**useMemo** - Memoize expensive calculations
```javascript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

**useRef** - Persistent values and DOM references
```javascript
const inputRef = useRef(null);
const countRef = useRef(0);

// Access DOM
inputRef.current.focus();

// Persist value without re-renders
countRef.current += 1;
```

**useContext** - Access context values
```javascript
const theme = useContext(ThemeContext);
const user = useContext(UserContext);
```

## Custom Hooks Patterns

**Data Fetching**
```javascript
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}
```

**Form Handling**
```javascript
function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setValues({
      ...values,
      [e.target.name]: e.target.value
    });
  };

  const reset = () => setValues(initialValues);

  return { values, errors, handleChange, reset };
}
```

**Local Storage Sync**
```javascript
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
```

## Component Patterns

**Compound Components**
```javascript
function Tabs({ children }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <TabsContext.Provider value={{ activeIndex, setActiveIndex }}>
      {children}
    </TabsContext.Provider>
  );
}

function TabList({ children }) {
  return <div className="tab-list">{children}</div>;
}

function Tab({ index, children }) {
  const { activeIndex, setActiveIndex } = useContext(TabsContext);
  return (
    <button
      className={activeIndex === index ? 'active' : ''}
      onClick={() => setActiveIndex(index)}
    >
      {children}
    </button>
  );
}

// Usage
<Tabs>
  <TabList>
    <Tab index={0}>First</Tab>
    <Tab index={1}>Second</Tab>
  </TabList>
  <TabPanels>
    <TabPanel index={0}>Content 1</TabPanel>
    <TabPanel index={1}>Content 2</TabPanel>
  </TabPanels>
</Tabs>
```

**Render Props**
```javascript
function DataProvider({ url, render }) {
  const { data, loading, error } = useFetch(url);
  return render({ data, loading, error });
}

// Usage
<DataProvider
  url="/api/users"
  render={({ data, loading }) => (
    loading ? <Spinner /> : <UserList users={data} />
  )}
/>
```

**Higher-Order Components**
```javascript
function withAuth(Component) {
  return function AuthComponent(props) {
    const { user, loading } = useAuth();

    if (loading) return <Spinner />;
    if (!user) return <Redirect to="/login" />;

    return <Component {...props} user={user} />;
  };
}
```

## UI Component Patterns

**Modal/Dialog**
```javascript
function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

**Dropdown/Select**
```javascript
function Dropdown({ options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useClickOutside(ref, () => setIsOpen(false));

  return (
    <div ref={ref} className="dropdown">
      <button onClick={() => setIsOpen(!isOpen)}>
        {value || 'Select...'}
      </button>
      {isOpen && (
        <ul>
          {options.map(opt => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Infinite Scroll**
```javascript
function InfiniteList({ fetchMore }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef();

  const lastItemRef = useCallback(node => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loading, hasMore]);

  const loadMore = async () => {
    setLoading(true);
    const newItems = await fetchMore();
    setItems(prev => [...prev, ...newItems]);
    setHasMore(newItems.length > 0);
    setLoading(false);
  };

  return (
    <div>
      {items.map((item, i) => (
        <div
          key={item.id}
          ref={i === items.length - 1 ? lastItemRef : null}
        >
          {item.content}
        </div>
      ))}
      {loading && <Spinner />}
    </div>
  );
}
```

## Security Best Practices

**XSS Prevention**
- Never use dangerouslySetInnerHTML unless absolutely necessary
- Sanitize user input with DOMPurify if HTML is required
- Use textContent instead of innerHTML for user data
- Validate and escape data from external sources

**Safe Rendering**
```javascript
// ✓ GOOD - React escapes by default
<div>{userInput}</div>

// ✗ BAD - XSS vulnerability
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✓ GOOD - Sanitized HTML
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userInput)
}} />
```

**Authentication & Authorization**
- Store tokens in httpOnly cookies, not localStorage
- Validate permissions on both client and server
- Implement proper CSRF protection
- Use secure context (HTTPS) for sensitive operations

## Testing

**Component Tests**
```javascript
import { render, screen, fireEvent } from '@testing-library/react';

test('button click increments counter', () => {
  render(<Counter />);
  const button = screen.getByRole('button');

  fireEvent.click(button);

  expect(screen.getByText('1')).toBeInTheDocument();
});
```

**Hook Tests**
```javascript
import { renderHook, act } from '@testing-library/react';

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

## Error Handling

**Error Boundaries**
```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

**Async Error Handling**
```javascript
function DataComponent() {
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData()
      .catch(err => setError(err));
  }, []);

  if (error) return <ErrorMessage error={error} />;

  return <Content />;
}
```

## File Structure

```
src/
├── components/
│   ├── common/          # Shared UI components
│   ├── features/        # Feature-specific components
│   └── layout/          # Layout components
├── hooks/               # Custom hooks
├── context/             # Context providers
├── utils/               # Helper functions
├── services/            # API services
└── types/               # TypeScript types
```

## Quick Reference

- **Always** use functional components
- **Prefer** composition over prop drilling
- **Extract** complex logic into custom hooks
- **Memoize** expensive operations and callbacks
- **Test** components with React Testing Library
- **Validate** props with TypeScript or PropTypes
- **Handle** errors with error boundaries
- **Sanitize** user input to prevent XSS
- **Keep** components small and focused
- **Document** complex logic and prop interfaces
