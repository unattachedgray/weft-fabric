# /browser — Browser automation via Chrome browser extension

Automate Chrome from Claude Code using the browser bridge extension. 72 commands across 12 categories: tab management, screenshots, form filling, data extraction, device emulation, network capture, and more.

**Requires**: browser bridge running + Chrome extension installed.

## Setup

First, define the browser helper in your bash session:

```bash
function browser() {
  local CMD_ID=$(curl -s -X POST http://localhost:8787/api/extension-commands \
    -H 'Content-Type: application/json' -d "$1" | jq -r '.id')
  sleep ${2:-6}
  curl -s http://localhost:8787/api/extension-commands/$CMD_ID | jq '.result'
}
```

Check if the extension is connected:
```bash
curl -s http://localhost:8787/api/extension-status | jq
```

## Quick Reference

### Read & Screenshot
```bash
browser '{"type":"read_page","url":"https://example.com","screenshot":false}'
browser '{"type":"screenshot","url":"https://example.com"}' 8
browser '{"type":"print_pdf","url":"https://example.com"}' 8
```

### Tab Management
```bash
browser '{"type":"list_tabs"}'
browser '{"type":"open_tab","url":"https://example.com"}'
browser '{"type":"close_tab","tabId":TAB_ID}'
browser '{"type":"adopt_tab","tabId":TAB_ID}'
browser '{"type":"navigate","tabId":TAB_ID,"url":"https://other.com"}'
```

### Interaction
```bash
browser '{"type":"click","tabId":TAB_ID,"selector":"#submit-btn"}'
browser '{"type":"fill_form","tabId":TAB_ID,"fields":[{"selector":"#email","value":"test@test.com"},{"selector":"#name","value":"Test"}]}'
browser '{"type":"submit_form","tabId":TAB_ID}'
browser '{"type":"select_option","tabId":TAB_ID,"selector":"#country","value":"US"}'
browser '{"type":"press_key","tabId":TAB_ID,"key":"Enter"}'
browser '{"type":"scroll_page","tabId":TAB_ID,"direction":"down","amount":500}'
browser '{"type":"drag_drop","tabId":TAB_ID,"from":"#source","to":"#target"}'
```

### Data Extraction
```bash
# Structured extraction with schema
browser '{"type":"extract_structured","tabId":TAB_ID,"schema":{"title":"h1","price":{"selector":".price","type":"number"},"items":{"selector":".item","type":"list","fields":{"name":"h3","link":{"selector":"a","type":"link"}}}}}'

# Auto-parse all HTML tables
browser '{"type":"extract_tables","tabId":TAB_ID}'

# JSON-LD, OpenGraph, Twitter Cards, RSS feeds
browser '{"type":"extract_metadata","tabId":TAB_ID}'

# CSS selector query
browser '{"type":"query_elements","tabId":TAB_ID,"selector":".product-card","attributes":["href","data-id"]}'
```

### AI Agent Commands
```bash
# Set-of-Mark: numbered labels on interactive elements + screenshot
browser '{"type":"annotate_interactive","tabId":TAB_ID}' 8

# Natural language element search
browser '{"type":"find_element","tabId":TAB_ID,"description":"login button"}'

# Self-healing click (caches selector, auto-recovers on DOM changes)
browser '{"type":"resilient_click","tabId":TAB_ID,"name":"login-btn","description":"login button","selector":"#login"}'

# Self-healing form fill
browser '{"type":"resilient_fill","tabId":TAB_ID,"name":"email-input","description":"email field","selector":"#email","value":"test@test.com"}'
```

### Multi-Step Workflows
```bash
browser '{"type":"workflow","steps":[
  {"type":"open_tab","url":"https://example.com"},
  {"type":"wait_for_selector","selector":"#form","delayMs":2000},
  {"type":"fill_form","fields":[{"selector":"#email","value":"test@test.com"}]},
  {"type":"submit_form"},
  {"type":"read_tab","textLimit":1000}
]}'
```

### Device Emulation
```bash
browser '{"type":"emulate_device","tabId":TAB_ID,"preset":"iphone16"}'
browser '{"type":"clear_emulation","tabId":TAB_ID}'
# Presets: iphone16, iphone16pro, pixel9, ipad, ipadpro, galaxys24, desktop1080, desktop1440, laptop
```

### Network & Debugging
```bash
# Network throttling
browser '{"type":"network_throttle","tabId":TAB_ID,"preset":"slow3g"}'

# HAR capture
browser '{"type":"start_har_capture","tabId":TAB_ID}'
browser '{"type":"stop_har_capture","tabId":TAB_ID}'

# Console logs
browser '{"type":"start_console_capture","tabId":TAB_ID}'
browser '{"type":"get_console_logs","tabId":TAB_ID}'

# Accessibility tree
browser '{"type":"get_full_accessibility_tree","tabId":TAB_ID}'

# iframe / shadow DOM
browser '{"type":"list_frames","tabId":TAB_ID}'
browser '{"type":"query_shadow_dom","tabId":TAB_ID,"hostSelector":"my-component"}'
```

### Browser State
```bash
browser '{"type":"get_cookies","tabId":TAB_ID}'
browser '{"type":"get_storage","tabId":TAB_ID,"storageType":"local"}'
browser '{"type":"set_storage","tabId":TAB_ID,"storageType":"local","key":"theme","value":"dark"}'
browser '{"type":"clipboard_read"}'
browser '{"type":"clipboard_write","text":"copied text"}'
```

### Other
```bash
browser '{"type":"set_geolocation","tabId":TAB_ID,"latitude":37.7749,"longitude":-122.4194}'
browser '{"type":"handle_dialog","tabId":TAB_ID,"action":"accept"}'
browser '{"type":"file_upload","tabId":TAB_ID,"selector":"input[type=file]","filePaths":["/tmp/doc.pdf"]}'
browser '{"type":"go_back","tabId":TAB_ID}'
```

### Layout Verification (Phase 4 — pretext-based)

Canvas-based text measurement commands — zero DOM reflow. Use after building or inspecting any web page.

```bash
# Quick health check (add to any read_page call)
browser '{"type":"read_page","url":"http://localhost:3000","layoutCheck":true}'

# Verify specific elements fit their containers
browser '{"type":"verify_layout","tabId":TAB_ID,"checks":[
  {"selector":"button","maxLines":1},
  {"selector":".card-title","fitsContainer":true,"maxLines":2},
  {"selector":"nav a","fitsWidth":true}
]}'

# Predict text layout before elements exist (e.g., during design)
browser '{"type":"predict_text_layout","text":"Submit Application","font":"16px Inter","maxWidth":120,"shrinkwrap":true}'

# Query elements with text overflow data
browser '{"type":"query_elements","tabId":TAB_ID,"selector":"button","measureText":true}'
```

Issue types from `detect_layout_issues`: `text_truncated`, `text_multiline_overflow`, `label_overflow`.

Full CSS patterns and verification checklist: See `/pretext-layout`.

## All 72 Commands

| Category | Commands |
|----------|----------|
| Tab mgmt (9) | open_tab, close_tab, read_tab, navigate, list_tabs, adopt_tab, list_managed, reload_tab, reload_usage |
| Screenshots (3) | screenshot, screenshot_element, capture_sequence |
| Interaction (9) | click, hover, drag_drop, fill_form, submit_form, select_option, press_key, scroll_page, wait_for_selector |
| Data extraction (6) | read_page, extract_structured, extract_tables, extract_metadata, query_elements, get_styles |
| AI agent (4) | annotate_interactive, find_element, resilient_click, resilient_fill |
| Iframe/Shadow (4) | list_frames, read_frame, execute_in_frame, query_shadow_dom |
| Debugging (6) | get_accessibility_tree, get_full_accessibility_tree, inspect_react, inspect_app_state, detect_layout_issues, execute_script |
| Capture (9) | start_console_capture, get_console_logs, get_page_errors, start_network_capture, get_network_logs, start_websocket_capture, get_websocket_logs, start_har_capture, stop_har_capture |
| Browser state (5) | get_cookies, get_storage, set_storage, clipboard_read, clipboard_write |
| Emulation (10) | emulate_device, clear_emulation, network_throttle, set_geolocation, clear_geolocation, handle_dialog, print_pdf, file_upload, go_back, go_forward |
| Layout verification (2) | verify_layout, predict_text_layout |
| Utility (5) | ping, status, extract_now, get_debug, workflow |
