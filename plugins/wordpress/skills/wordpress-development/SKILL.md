---
name: wordpress-development
description: Use when building or designing WordPress sites - covers block themes, plugin development, custom blocks, REST API, Site Editor, theme.json styling, accessibility, security, performance optimization, and wp.org compliance
---

# WordPress Development

## Overview

Comprehensive WordPress development and design reference covering block-based themes, Site Editor workflows, plugin architecture, custom blocks (apiVersion 3), REST API, theme.json styling, accessibility (WCAG 2.2 AA), security hardening, performance optimization, and wp.org compliance. Targets WordPress 6.9+ / PHP 7.2.24+.

## Site Editor & Design System

**Access:** Appearance > Editor

**Five sections:** Navigation, Styles, Pages, Templates, Patterns

**Command Palette:** Cmd+K (Mac) / Ctrl+K (Windows)

**Style Book:** Access via Styles > eye icon. 5 tabs: Text, Media, Design, Widgets, Theme. Preview every block type before inserting.

### Style Hierarchy (lowest to highest)

1. Core defaults (`wp-includes/theme.json`)
2. Theme `theme.json`
3. Child theme `theme.json`
4. User customizations via Site Editor (DB)

User customizations can override theme.json edits. Test with fresh site or reset customizations when debugging.

### theme.json Configuration

**Colors:** Use purpose-based names (Primary, Accent, Contrast), not color names.

```json
"settings": {
    "color": {
        "palette": [
            { "color": "#005A8D", "name": "Primary", "slug": "primary" },
            { "color": "#F4F4F4", "name": "Background", "slug": "background" }
        ]
    }
}
```

**Typography:** Configure fonts in theme.json or via Site Editor > Typography > Fonts.

**Border Radius (WP 6.9+):** Define preset border radii in `settings.border.radiusSizes`.

**Form Elements (WP 6.9+):** Style inputs/selects via `styles.elements.input`, `styles.elements.select`.

**Button States (WP 6.9+):** Style hover/focus states directly in theme.json.

## Theme Development

### Block Theme Structure

**Required:** `style.css` (metadata) + `templates/index.html` (fallback)

**Directories:** `templates/`, `parts/`, `patterns/`, `styles/`, `assets/`

**Template parts:** Files in `parts/` (flat, no subdirectories). Changes propagate site-wide.

**Patterns:** Files in `patterns/*.php` with headers. Synced patterns (purple) propagate site-wide.

**Style variations:** JSON files in `styles/`. User selections stored in DB.

### Template Hierarchy

| Template | Purpose |
|----------|---------|
| Front Page | Takes precedence over all |
| Page | Default for pages |
| Single Post | Individual post layout |
| Blog Home | Posts listing |
| Archives | Category/tag/date/author |
| Search Results | Search display |
| 404 | Page not found |
| Index | Fallback for all content |

Templates use **Post Content block** as content placeholder.

### Child Themes

**Minimum:** `style.css` with `Template: parent-slug` header.

Can override: templates, parts, patterns, `theme.json`, `functions.php`.

### Theme Setup

```php
add_action('after_setup_theme', 'theme_setup');
function theme_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('align-wide');
}
```

## Layout & Design Blocks

**Group Block:** Four variations: Group, Row, Stack, Grid. Supports sticky positioning.

**Row:** Horizontal layout with wrapping, justification.

**Stack:** Vertical layout with alignment.

**Columns:** Up to 6 columns. Stack on Mobile enabled by default.

**Spacing Controls:**
- **Padding:** Space inside block
- **Margin:** Space outside block
- **Block Spacing:** Gap between nested blocks

**Cover Block:** Text/content over images/videos. Supports overlay, parallax, focal point.

**Media and Text:** Side-by-side image + text. Toggle positioning, Stack on Mobile.

**Gallery:** Multi-image display. Always include alt text.

## WordPress Development Fundamentals

### Hooks System

| Type | Define | Register |
|------|--------|----------|
| Action | `do_action('hook')` | `add_action('hook', 'cb')` |
| Filter | `apply_filters('hook', $data)` | `add_filter('hook', 'cb')` |

**CRITICAL:** Filter callbacks MUST return data.

**Key Hooks:**
- `init` - Register post types, taxonomies, meta
- `after_setup_theme` - `add_theme_support()`
- `wp_enqueue_scripts` - Frontend assets
- `admin_enqueue_scripts` - Admin assets
- `rest_api_init` - Register REST routes

### Custom Post Types & Taxonomies

```php
add_action('init', 'register_custom_types');
function register_custom_types() {
    register_post_type('book', [
        'public' => true,
        'has_archive' => true,
        'show_in_rest' => true, // REQUIRED for block editor + REST
        'supports' => ['title', 'editor', 'thumbnail'],
    ]);
    
    register_taxonomy('genre', 'book', [
        'hierarchical' => true,
        'show_in_rest' => true,
    ]);
}
```

## Plugin Development

### Plugin Architecture

**Bootstrap pattern:** Single main file with header, minimal boot, loader class for hooks.

- Keep admin-only code behind `is_admin()` or admin hooks
- Prefix all functions/classes with plugin slug

### Lifecycle Hooks

Register at top-level scope:

```php
register_activation_hook(__FILE__, 'plugin_activate');
function plugin_activate() {
    // Create tables, set defaults
    // Register CPTs then flush_rewrite_rules()
}

register_deactivation_hook(__FILE__, 'plugin_deactivate');
```

**Uninstall:** Create `uninstall.php`. Check `WP_UNINSTALL_PLUGIN`. Remove ALL plugin data.

### Settings API

```php
add_action('admin_init', 'register_settings');
function register_settings() {
    register_setting('my_group', 'my_option', [
        'sanitize_callback' => 'sanitize_text_field'
    ]);
    add_settings_section('my_section', 'Title', 'render_cb', 'my-page');
    add_settings_field('my_field', 'Label', 'field_cb', 'my-page', 'my_section');
}
```

Always use `sanitize_callback`.

## Block Development

### Block Scaffold

**Scaffold:** `npx @wordpress/create-block block-name`

**block.json** defines metadata, attributes, render file.

**apiVersion 3** REQUIRED for WP 6.9+. WP 7.0 will iframe the editor. Always use `apiVersion: 3`.

**Block models:**
- **Static:** `save()` renders HTML. Changing markup requires `deprecated` array.
- **Dynamic:** `"render": "file:./render.php"` — server-rendered. Preferred for data-driven blocks.
- **Interactive:** Add `viewScript` for frontend JS.

### Block Wrappers

**REQUIRED for alignment, spacing, colors:**

**Edit (JSX):**
```jsx
import { useBlockProps } from '@wordpress/block-props';
export default function Edit() {
    return <div {...useBlockProps()}>Content</div>;
}
```

**Save (static):**
```jsx
return <div {...useBlockProps.save()}>Content</div>;
```

**Render (dynamic PHP):**
```php
<div <?php echo get_block_wrapper_attributes(); ?>>Content</div>
```

### Block Hooks API (WP 6.5+)

```php
register_block_type(__DIR__ . '/build/my-block', [
    'block_hooks' => [
        'core/navigation' => 'last_child' // before|after|first_child|last_child
    ]
]);
```

### Interactivity API (WP 6.5+)

Frontend interactivity without custom frameworks. Directives: `data-wp-interactive`, `data-wp-on--click`, `data-wp-bind--hidden`, `data-wp-text`.

## REST API

### Client Options

1. `wp.apiFetch()` - dependency: `wp-api-fetch` (recommended)
2. `@wordpress/core-data` + `useSelect()` - for blocks/React

### Custom Routes

```php
add_action('rest_api_init', 'register_routes');
function register_routes() {
    register_rest_route('vendor/v1', '/items', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'get_items',
        'permission_callback' => '__return_true', // REQUIRED
        'args' => ['per_page' => ['type' => 'integer', 'default' => 10]]
    ]);
}
```

- Use unique namespace `vendor/v1`
- Always provide `permission_callback`
- Use `WP_REST_Request` params, never `$_GET`/`$_POST` directly
- Return `WP_REST_Response` or `WP_Error`
- `per_page` capped at 100

**Auth:** Cookie + `X-WP-Nonce` for wp-admin/JS. Application passwords for external clients.

## Security (5 Pillars)

1. **Sanitize:** `sanitize_text_field()`, `sanitize_email()`, `(int)` casting. Use `wp_unslash()` first.
2. **Validate:** Type-check + reject invalid early
3. **Escape:** `esc_html()` (content), `esc_attr()` (attributes), `esc_url()` (URLs). Escape at output.
4. **Nonces:** Prevent CSRF, NOT authorization. Pair with capability checks.
5. **Capabilities:** `current_user_can('manage_options')` before sensitive actions

**SQL:** Use `$wpdb->insert()`, `$wpdb->delete()`, `$wpdb->prepare()`. Never interpolate user input.

**Redirects:** `wp_safe_redirect()` not `wp_redirect()`.

**Never process entire `$_POST`/`$_GET` array** — read explicit keys only.

## Performance Anti-Patterns

### Critical (causes failures at scale)

- `posts_per_page => -1` — unbounded query, OOM. Set limit + paginate.
- `query_posts()` — breaks main query. Use `WP_Query` or `pre_get_posts`.
- `session_start()` — bypasses ALL cache.
- DB writes on every page load
- N+1 queries in loops
- `setInterval` + fetch = self-DDoS

### Warnings

- Missing `no_found_rows => true` when not paginating
- `meta_query` with `value` comparisons — unindexed
- `post__not_in` with large arrays
- `LIKE '%term%'` — leading wildcard = full table scan
- Uncached expensive calls: `url_to_postid()`, `attachment_url_to_postid()`
- `wp_remote_get` without timeout or caching
- Global asset enqueue — load conditionally

## Accessibility (WCAG 2.2 AA)

### Typography

- Base font: minimum 16px
- Line height: minimum 1.5
- Underlines exclusively for links

### Structure

- Heading hierarchy: H2 > H3 > H4 (never skip)
- Use Document Overview > Outline to check

### Requirements

- Keyboard-operable (Tab navigation)
- Form inputs need labels
- Alt text required for images
- Video captions required
- Test with WebAIM Contrast Checker

### Testing Plugins

**Sa11y**, **WP Tota11y**, **Editoria11y**, **Accessibility Checker**

## Asset Management

```php
add_action('wp_enqueue_scripts', 'enqueue_assets');
function enqueue_assets() {
    wp_enqueue_style('handle', get_template_directory_uri() . '/style.css');
    wp_enqueue_script('handle', get_template_directory_uri() . '/file.js',
        ['jquery'], '1.0', ['strategy' => 'defer']);
}
```

**Build Process:**

```bash
npm install @wordpress/scripts --save-dev
```

```json
"scripts": {
    "start": "wp-scripts start",
    "build": "wp-scripts build"
}
```

## Standards & Compliance

### WPCS Coding Standards

- Spaces inside parentheses: `function_name( $arg )`
- Array syntax: `array( 'key' => 'val' )`
- Yoda conditions: `if ( true === $value )`
- Naming: `snake_case`, prefix all custom functions

### wp.org Compliance

- No premium/locked code
- No tracking without consent
- Use WordPress APIs
- All output escaped; all input sanitized
- Include `uninstall.php`
- Text domain matches plugin slug

### Internationalization

**PHP:** `__('text', 'domain')`, `_e('text', 'domain')`

**JS:** `import { __ } from '@wordpress/i18n'`

## Modern APIs & Tooling (WP 6.5+)

### Block Bindings API (WP 6.5+, stable 6.7)

Bind core block attributes (Paragraph text, Image src/alt, Button URL/label, Heading content) to dynamic sources (post meta, custom sources) without writing custom blocks. Removes most need for dynamic blocks when the difference is just "data source."

```php
register_block_bindings_source( 'my-plugin/featured-author', [
    'label'              => __( 'Featured Author' ),
    'get_value_callback' => function( $args, $block, $attr_name ) {
        return get_post_meta( $block->context['postId'], 'featured_author', true );
    },
    'uses_context'       => [ 'postId' ],
] );
```

In block markup (or via editor UI):
```
<!-- wp:paragraph {"metadata":{"bindings":{"content":{"source":"my-plugin/featured-author"}}}} -->
```

### Pattern Overrides (WP 6.6+)

Synced patterns with per-instance overrides — replaces "reusable blocks" for the case where 90% should sync but specific fields shouldn't. Uses `core/pattern-overrides` source via `metadata.bindings`.

### Section Styles (WP 6.6+)

Block-level style variations defined in `theme.json` under `styles.blocks.[name].variations`. Users pick them from the editor. Replaces hand-rolled CSS classes for "card variant A / variant B."

### Interactivity API store + state (WP 6.5+)

The directives shown earlier (`data-wp-interactive`, `data-wp-on--click`, etc.) wire to a client-side store:

```js
import { store, getContext } from '@wordpress/interactivity';
store( 'my-plugin', {
    state: { isOpen: false },
    actions: { toggle() { this.state.isOpen = !this.state.isOpen; } },
} );
```

Hydrate from PHP:
```php
wp_interactivity_state( 'my-plugin', [ 'isOpen' => false ] );
```

Use `viewScriptModule` (not `viewScript`) in `block.json` to load as a native ES module.

### REST: register_rest_field + schema

For adding fields to existing object types (post, user, etc.) without a custom endpoint:

```php
register_rest_field( 'post', 'reading_time', [
    'get_callback'    => fn( $obj ) => estimate_reading_time( $obj['content']['rendered'] ),
    'update_callback' => null,
    'schema'          => [ 'type' => 'integer', 'context' => [ 'view', 'edit' ] ],
] );
```

Always define schema → enables auto-validation, self-documentation at `/wp-json`.

### SQL: %i identifier placeholder (WP 6.2+)

For dynamic table/column names, `%i` quotes identifiers safely. Replaces hand-escaping with backticks.

```php
$wpdb->prepare( "SELECT * FROM %i WHERE %i = %d", $table, $col, $id );
```

### Background jobs: Action Scheduler

`wp_schedule_event()` is fine for light jobs but it's request-triggered (no real cron). For heavy work (queue processing, batched migrations, async API calls), use the **Action Scheduler** library — bundled with WooCommerce, available standalone. Persistent queue, retry logic, admin UI for inspection.

### Local dev: wp-env

`@wordpress/env` (`wp-env`) is the official Docker-based local dev environment. `.wp-env.json` configures core version, PHP version, plugins, themes, and mappings — repeatable team setups without LocalWP / MAMP variance.

```json
{
  "core": "WordPress/WordPress#6.7",
  "phpVersion": "8.2",
  "plugins": [ ".", "WordPress/gutenberg" ],
  "mappings": { "wp-content/uploads": "./test-uploads" }
}
```

```bash
wp-env start
wp-env run cli wp plugin list
```

### Build tooling: wp-scripts internals

`@wordpress/scripts` wraps webpack with sensible defaults. Reads `src/block.json` and emits `build/`.

- `wp-scripts start` (watch) / `wp-scripts build` (prod) / `wp-scripts lint-js` / `format` / `test-unit-js`
- Auto-emits `*.asset.php` per entry with `dependencies` (e.g., `wp-blocks`, `wp-element`) + content hash. **Always pass this asset file's `dependencies` and `version` to `wp_enqueue_script()`** — manual deps drift.
- TypeScript supported via `tsconfig.json` + `.ts`/`.tsx`; `@wordpress/scripts` 27+ has built-in TS handling.
- Custom webpack config: `webpack.config.js` extending `@wordpress/scripts/config/webpack.config`.

## Common Mistakes

- Forgetting `show_in_rest => true` (breaks block editor + REST)
- Not returning data from filter callbacks (fatal)
- Using `wp_redirect()` instead of `wp_safe_redirect()` (open redirect)
- Raw SQL instead of `$wpdb` (SQL injection)
- Missing nonce verification (CSRF)
- Nonce without capability check
- Registering post types outside `init` hook
- Registering activation hooks inside other hooks
- `posts_per_page => -1` on frontend (OOM)
- Missing `permission_callback` on REST routes
- Changing `name` in block.json (breaks instances)
- Changing save markup without `deprecated` array
- Color slugs named after colors vs purpose
- Processing entire `$_POST`/`$_GET`
- Skipping heading levels
- Missing alt text
- Nesting template parts in subdirectories
