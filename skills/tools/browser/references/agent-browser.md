# agent-browser — Interactive Browser Automation

Browser automation CLI designed for AI agents. Use when you need to **interact**
with a web page — clicking, filling forms, navigating, taking screenshots, or
testing UI behavior. For read-only page fetching, prefer Lightpanda instead.

The binary is at `{baseDir}/node_modules/.bin/agent-browser`.

## Core Workflow

agent-browser uses a **ref-based** model: take a snapshot of the page to get
an accessibility tree with element refs, then interact using those refs.

```bash
ab="{baseDir}/node_modules/.bin/agent-browser"

# 1. Open a page
$ab open 'https://example.com'

# 2. Snapshot — get the accessibility tree with refs
$ab snapshot -i

# Output:
# @e1 [header]
#   @e2 [a] "Home"
#   @e3 [a] "Products"
# @e4 [button] "Sign In"
# @e5 [input type="email"] placeholder="Email"

# 3. Interact using refs
$ab click @e4
$ab fill @e5 'user@example.com'

# 4. Re-snapshot after navigation or DOM changes
$ab snapshot -i

# 5. Close when done
$ab close
```

Set `ab="{baseDir}/node_modules/.bin/agent-browser"` once per session, then use `$ab` for all commands.

## Command Chaining

Commands can be chained with `&&` since the browser persists via a background daemon.
Chain when you don't need intermediate output; run separately when you need to read
snapshots before interacting.

```bash
# Chain open + wait + snapshot
$ab open 'https://example.com' && $ab wait --load networkidle && $ab snapshot -i

# Chain multiple fills
$ab fill @e1 'user@example.com' && $ab fill @e2 'password' && $ab click @e3
```

## Navigation

```bash
$ab open '<url>'              # Open a URL (auto-prepends https:// if no protocol)
$ab back                      # Go back
$ab forward                   # Go forward
$ab reload                    # Reload page
$ab close                     # Close browser
$ab close --all               # Close all active sessions
```

## Snapshots

```bash
$ab snapshot                  # Full accessibility tree
$ab snapshot -i               # Interactive elements only (recommended)
$ab snapshot -c               # Compact output
$ab snapshot -d 3             # Limit depth to 3
$ab snapshot -s "#main"       # Scope to CSS selector
```

**IMPORTANT**: Refs are invalidated when the page changes. Always re-snapshot after
navigation, form submissions, or dynamic DOM changes (dropdowns, modals).

## Interaction

```bash
$ab click @e1                 # Click element
$ab click @e1 --new-tab       # Click and open in new tab
$ab dblclick @e1              # Double-click
$ab fill @e2 'text'           # Clear field and type (use for form inputs)
$ab type @e2 'text'           # Type without clearing (append text)
$ab press Enter               # Press key
$ab press Control+a           # Key combination
$ab keyboard type 'text'      # Type at current focus (no selector)
$ab hover @e1                 # Hover
$ab focus @e1                 # Focus element
$ab scroll down 500           # Scroll page (default: down 300px)
$ab scrollintoview @e1        # Scroll element into view
$ab drag @e1 @e2              # Drag and drop
$ab upload @e1 file.pdf       # Upload files
$ab download @e1 ./file.pdf   # Download by clicking element
```

**`fill` vs `type`**: Use `fill` for form fields (clears first). Use `type` to append text or for non-input elements.

## Forms

```bash
$ab fill @e1 'user@example.com'   # Fill a field (clears first)
$ab clear @e1                     # Clear a field
$ab check @e1                     # Check a checkbox
$ab uncheck @e1                   # Uncheck
$ab select @e1 'option1'          # Select from dropdown
$ab select @e1 'a' 'b'            # Select multiple options
$ab click @e9                     # Submit button
```

## Wait

Use explicit waits instead of fixed delays when possible:

```bash
$ab wait @e1                       # Wait for element to appear
$ab wait 2000                      # Wait milliseconds (last resort)
$ab wait --text 'Success'          # Wait for text to appear
$ab wait --url '**/dashboard'      # Wait for URL pattern
$ab wait --load networkidle        # Wait for network to settle (best for slow pages)
$ab wait --fn 'window.ready'       # Wait for JS condition
$ab wait '#spinner' --state hidden # Wait for element to disappear
```

## Get Information

```bash
$ab get text @e1              # Get element text
$ab get text body             # Get all page text
$ab get html @e1              # Get innerHTML
$ab get value @e1             # Get input value
$ab get attr @e1 href         # Get attribute
$ab get title                 # Get page title
$ab get url                   # Get current URL
$ab get count '.item'         # Count matching elements
$ab get box @e1               # Get bounding box
$ab get styles @e1            # Get computed styles
```

## Check State

```bash
$ab is visible @e1            # Check if visible
$ab is enabled @e1            # Check if enabled
$ab is checked @e1            # Check if checked
```

## Semantic Locators (Alternative to Refs)

When refs are unavailable or unreliable, find elements by semantic properties:

```bash
$ab find role button click --name 'Submit'
$ab find text 'Sign In' click
$ab find text 'Sign In' click --exact        # Exact match only
$ab find label 'Email' fill 'user@test.com'
$ab find placeholder 'Search' type 'query'
$ab find testid 'submit-btn' click
$ab find first '.item' click
$ab find nth 2 'a' hover
```

## Screenshots and PDF

```bash
$ab screenshot                    # Save to temp directory
$ab screenshot page.png           # Save to specific path
$ab screenshot --full             # Full page screenshot
$ab screenshot --annotate         # Annotated with numbered element labels
$ab screenshot --element @e3 el.png  # Specific element
$ab pdf output.pdf                # Save as PDF
```

**Annotated screenshots**: `--annotate` overlays numbered labels on interactive elements.
Each label `[N]` maps to ref `@eN`. Use when pages have unlabeled icons, visual-only
elements, canvas/charts, or when you need spatial reasoning.

## JavaScript Execution

Shell quoting can corrupt complex expressions — use `--stdin` or `-b` for reliability.

```bash
# Simple expressions
$ab eval 'document.title'

# Complex JS — use heredoc (recommended)
cat <<'EOF' | $ab eval --stdin
const links = document.querySelectorAll('a');
JSON.stringify(Array.from(links).map(a => a.href));
EOF

# Or base64 encoding
$ab eval -b "$(echo -n 'document.querySelectorAll("a").length' | base64)"
```

## Frames / Iframes

Iframe content is automatically inlined in snapshots. Refs inside iframes work directly.

```bash
$ab snapshot -i
# @e1 [heading] "Checkout"
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
#   @e4 [button] "Pay"

# Interact directly — no frame switch needed
$ab fill @e3 '4111111111111111'
$ab click @e4

# Or scope snapshot to a single iframe
$ab frame @e2                 # Switch to iframe
$ab snapshot -i               # Scoped snapshot
$ab frame main                # Return to main frame
```

## Dialogs

By default, `alert` and `beforeunload` are auto-accepted. `confirm` and `prompt` need explicit handling.

```bash
$ab dialog accept              # Accept dialog
$ab dialog accept 'my input'   # Accept prompt with text
$ab dialog dismiss             # Dismiss dialog
$ab dialog status              # Check if dialog is open
```

If commands start timing out unexpectedly, check for a pending dialog with `dialog status`.

## Tabs

```bash
$ab tab                       # List tabs
$ab tab new 'https://...'     # New tab
$ab tab 2                     # Switch to tab by index
$ab tab close                 # Close current tab
```

## Sessions

Isolated browser instances with independent cookies, storage, and history:

```bash
$ab --session admin open 'https://site.com/admin'
$ab --session user open 'https://site.com'
$ab --session admin snapshot -i
$ab --session admin close
$ab close --all               # Close all sessions
```

### Session Persistence

```bash
# Auto-save/restore cookies + localStorage by name
$ab --session-name myapp open 'https://app.example.com/login'
# ... login ...
$ab close  # State auto-saved

# Next time: state auto-restored
$ab --session-name myapp open 'https://app.example.com/dashboard'
```

### State Save/Load

```bash
$ab state save auth.json      # Save cookies, storage, auth state
$ab state load auth.json      # Restore saved state
```

## Authentication

### Quick: Import from your browser

```bash
# Connect to running Chrome (already logged in)
$ab --auto-connect state save ./auth.json
# Reuse
$ab --state ./auth.json open 'https://app.example.com/dashboard'
```

### Auth Vault (credentials stored encrypted)

```bash
echo "$PASSWORD" | $ab auth save myapp --url 'https://app.example.com/login' --username user --password-stdin
$ab auth login myapp
```

### Basic login flow

```bash
$ab open 'https://app.example.com/login'
$ab snapshot -i
$ab fill @e1 "$USERNAME"
$ab fill @e2 "$PASSWORD"
$ab click @e3
$ab wait --url '**/dashboard'
$ab state save auth.json       # Save for reuse
```

For OAuth, 2FA, and advanced patterns, read `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/authentication.md`.

## Browser Settings

```bash
$ab set viewport 1920 1080            # Set viewport size (default: 1280x720)
$ab set viewport 1920 1080 2          # 2x retina
$ab set device 'iPhone 14'            # Emulate device (viewport + user agent)
$ab set geo 37.7749 -122.4194         # Set geolocation
$ab set offline on                    # Toggle offline mode
$ab set headers '{"X-Key":"v"}'       # Extra HTTP headers
$ab set credentials user pass         # HTTP basic auth
$ab set media dark                    # Emulate color scheme
$ab set media light reduced-motion    # Light mode + reduced motion
```

## Network

```bash
$ab network requests                   # View tracked requests
$ab network requests --filter api      # Filter requests
$ab network requests --type xhr,fetch  # Filter by resource type
$ab network route '**/api/*' --abort   # Block matching requests
$ab network route '**/api/*' --body '{}' # Mock response
$ab network unroute                    # Remove all routes
$ab network har start                  # Start HAR recording
$ab network har stop ./capture.har     # Stop and save HAR
```

## Cookies and Storage

```bash
$ab cookies                           # Get all cookies
$ab cookies set name value            # Set cookie
$ab cookies clear                     # Clear cookies
$ab storage local                     # Get all localStorage
$ab storage local key                 # Get specific key
$ab storage local set k v             # Set value
$ab storage local clear               # Clear all
```

## Diff (Verify Changes)

```bash
$ab diff snapshot                      # Compare current vs last snapshot
$ab diff screenshot --baseline before.png  # Visual pixel diff
$ab diff url '<url1>' '<url2>'         # Compare two pages
```

## Downloads

```bash
$ab download @e1 ./file.pdf            # Click element to trigger download
$ab wait --download ./output.zip       # Wait for any download
$ab --download-path ./downloads open '<url>'  # Set default download dir
```

## Clipboard

```bash
$ab clipboard read                     # Read from clipboard
$ab clipboard write 'text'             # Write to clipboard
$ab clipboard copy                     # Copy current selection
$ab clipboard paste                    # Paste
```

## Video Recording

```bash
$ab record start ./demo.webm          # Start recording
# ... perform actions ...
$ab record stop                        # Stop and save
```

## Global Options

```bash
$ab --session <name> ...              # Isolated browser session
$ab --session-name <name> ...         # Persistent session (auto-save/restore)
$ab --json ...                        # JSON output for parsing
$ab --headed ...                      # Show browser window
$ab --full ...                        # Full page screenshot
$ab --cdp <port> ...                  # Connect via CDP
$ab --proxy <url> ...                 # Use proxy server
$ab --content-boundaries ...          # Wrap page content in markers (AI safety)
$ab --ignore-https-errors ...         # Ignore SSL errors
$ab --allow-file-access ...           # Allow file:// URLs
$ab --extension <path> ...            # Load browser extension (repeatable)
$ab --color-scheme dark ...           # Force dark mode
$ab --download-path <dir> ...         # Default download directory
```

## Environment Variables

```bash
AGENT_BROWSER_SESSION="mysession"            # Default session name
AGENT_BROWSER_HEADED=1                       # Show browser window
AGENT_BROWSER_COLOR_SCHEME=dark              # Force dark mode
AGENT_BROWSER_CONTENT_BOUNDARIES=1           # Wrap page content in markers
AGENT_BROWSER_ALLOWED_DOMAINS="example.com"  # Domain allowlist
AGENT_BROWSER_MAX_OUTPUT=50000               # Prevent context flooding
AGENT_BROWSER_DEFAULT_TIMEOUT=25000          # Default command timeout (ms)
AGENT_BROWSER_EXECUTABLE_PATH="/path/chrome" # Custom browser path
AGENT_BROWSER_IDLE_TIMEOUT_MS=60000          # Auto-shutdown after inactivity
```

## Debugging

```bash
$ab --headed open 'https://...'       # Show browser window
$ab console                           # View console messages
$ab errors                            # View page errors
$ab highlight @e1                     # Highlight element
$ab inspect                           # Open Chrome DevTools
$ab trace start                       # Record trace
$ab trace stop trace.zip              # Save trace
```

## Tips

- **Always snapshot before interacting** — refs don't exist until you take a snapshot
- **Use `snapshot -i`** for forms and interactive pages — filters to actionable elements
- **Take a new snapshot after navigation** — refs from the old page are stale
- **Use `fill` not `type` for form fields** — `fill` clears first, `type` appends
- **Use `wait --load networkidle` for slow pages** — more reliable than fixed delays
- **Use `eval --stdin`** for complex JS — avoids shell escaping issues
- **Screenshots for visual verification** — check layout, colors, visibility
- **`close --all` for cleanup** — ensures no leaked browser processes
- **If Lightpanda fails**, use `$ab open '<url>' && $ab get text body` as a Chrome fallback

## Deep-Dive References

For detailed guidance on specific topics, read these bundled references:

| Topic | Path |
|-------|------|
| Full command reference | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/commands.md` |
| Snapshot refs lifecycle | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/snapshot-refs.md` |
| Authentication patterns | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/authentication.md` |
| Session management | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/session-management.md` |
| Video recording | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/video-recording.md` |
| Profiling | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/profiling.md` |
| Proxy support | `{baseDir}/node_modules/agent-browser/skills/agent-browser/references/proxy-support.md` |

## Examples

### Fill and Submit a Form

```bash
ab="{baseDir}/node_modules/.bin/agent-browser"
$ab open 'https://example.com/login'
$ab snapshot -i
# @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Sign in"
$ab fill @e1 'user@example.com'
$ab fill @e2 'password123'
$ab click @e3
$ab wait --load networkidle
$ab snapshot -i   # Verify result
$ab close
```

### Extract Data

```bash
ab="{baseDir}/node_modules/.bin/agent-browser"
$ab open 'https://example.com/products'
$ab wait --load networkidle
$ab snapshot -i
$ab get text @e5                    # Specific element
$ab get text body > page.txt        # Full page text
$ab close
```

### Visual Testing

```bash
ab="{baseDir}/node_modules/.bin/agent-browser"
$ab open 'http://localhost:3000'
$ab screenshot before.png
$ab set media dark
$ab screenshot after.png
$ab diff screenshot --baseline before.png
$ab close
```

### Responsive Testing

```bash
ab="{baseDir}/node_modules/.bin/agent-browser"
$ab open 'https://example.com'
$ab set viewport 1920 1080 && $ab screenshot desktop.png
$ab set viewport 375 812 && $ab screenshot mobile.png
$ab set device 'iPhone 14' && $ab screenshot iphone.png
$ab close
```
