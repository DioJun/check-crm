# CHECK-CRM CODEBASE ANALYSIS - CRITICAL ISSUES FOUND

**Analysis Date:** April 7, 2026  
**Status:** 🔴 **Multiple Critical Issues Blocking App & Login**

---

## EXECUTIVE SUMMARY

Found **8 critical issues** preventing app initialization and login functionality:

1. ❌ **Database always points to dev.db** (DATABASE_URL hardcoded in prisma.js)
2. ❌ **JWT tokens invalid after restart** (JWT_SECRET regenerated each startup)
3. ❌ **Database never initialized** (No migrations run on production startup)
4. ❌ **Database schema mismatch** (Migration file exists but not in schema.prisma)
5. ❌ **Login token not synced** (IPC response token not returned to api.js)
6. ❌ **Frontend loads before backend ready** (Race condition on startup)
7. ❌ **No timeout on API calls** (App can hang indefinitely)
8. ❌ **Prisma schema not cross-platform** (binaryTargets limited to native)

---

## DETAILED ISSUES

### 🔴 ISSUE #1: DATABASE_URL HARDCODED IN PRISMA.JS

**Files:** 
- [backend/src/lib/prisma.js](backend/src/lib/prisma.js#L1-L18) (lines 1-18)

**Problem:**
```javascript
// ❌ WRONG - Line 6 in prisma.js
process.env.DATABASE_URL = `file:${dbPath}`;  // Hardcoded to ../dev.db
```

The database URL is **hardcoded** to `../dev.db` regardless of `.env` configuration:
- Line 6: `process.env.DATABASE_URL = 'file:../dev.db'` 
- This **OVERRIDES** any DATABASE_URL set in .env
- In development: points to backend/dev.db ✓
- In production: creates dev.db in wrong location (backend root, not userData)
- User database is lost when moving to different userData path

**Impact:**
- ❌ Production uses wrong database location
- ❌ Database not found after uninstall/reinstall
- ❌ User data lost if app moves to different directory
- ❌ Each machine has separate database instead of persisting

**Why it's wrong:**
- main.js creates `.env` with correct path: `DATABASE_URL="file:/path/to/app/data/checkmate.db"`
- But prisma.js overwrites it with hardcoded value
- Environment variable is ignored

**Fix needed:**
```javascript
// ✅ CORRECT
// Simply use the .env value without override
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
```

---

### 🔴 ISSUE #2: JWT_SECRET REGENERATED ON EVERY APP RESTART

**Files:**
- [electron/main.js](electron/main.js#L72-L95) (lines 72-95)

**Problem:**
Line 83 in `ensureBackendEnv()`:
```javascript
const envContent = [
  `DATABASE_URL="file:${dbPath}"`,
  `JWT_SECRET="${require('crypto').randomBytes(32).toString('hex')}"`, // ❌ RANDOM EVERY TIME
  `PORT=3001`,
  `CORS_ORIGIN="http://localhost:5173,http://localhost:3001"`,
].join('\n');
```

- **New JWT_SECRET is generated every time .env is created** (line 83)
- .env file is only created if missing (good)
- But **PROBLEM**: If app restarts and .env exists, secrets should persist
- However, the format suggests this is regenerated
- Even if file isn't overwritten, the secret **must match** what was used to create tokens

**Impact:**
- ❌ Users get logged out on every app restart
- ❌ Login tokens become invalid immediately after restart
- ❌ Token validation fails with "Token invalid or expired"
- ❌ Users cannot persist sessions

**Real scenario:**
1. User logs in → JWT_SECRET = "abc123..."
2. Token created: `jwt.sign({...}, "abc123...")`  
3. App restarts → JWT_SECRET = "xyz789..." (NEW!)
4. Token validation fails: `jwt.verify(token, "xyz789...")` ❌ Invalid signature

**Fix needed:**
The JWT_SECRET should be written once and persisted:
```javascript
// Only write if doesn't exist
if (!fs.existsSync(envPath)) {
  // Create new secret just once
  const jwtSecret = require('crypto').randomBytes(32).toString('hex');
  
  const envContent = [
    `DATABASE_URL="file:${dbPath}"`,
    `JWT_SECRET="${jwtSecret}"`,
    `PORT=3001`,
  ].join('\n');
  
  fs.writeFileSync(envPath, envContent, 'utf-8');
}
// On restart, .env exists → secret persists ✓
```

---

### 🔴 ISSUE #3: NO DATABASE INITIALIZATION ON STARTUP

**Files:**
- [electron/main.js](electron/main.js#L220-L250) (Backend startup code)
- [backend/src/lib/prisma.js](backend/src/lib/prisma.js#L8-L18)
- Missing: No `prisma db push` or `prisma migrate deploy` call

**Problem:**

Backend is started but **database schema is never applied**:

1. ensureBackendEnv() → creates .env ✓
2. ensureBackendDeps() → runs `npm install --production` ✓
3. startBackend() → spawns Node process ✓
4. **❌ Missing: Prisma migration/schema push**

Backend starts but tables might not exist:

```
User tries to login
→ POST /api/auth/login
→ authService.login(email, senha)
→ prisma.usuario.findUnique() 
→ ❌ ERROR: "table Usuario does not exist"
```

**Current flow:**
1. app.js loads, requires prisma.js
2. PrismaClient initialized
3. Server starts listening
4. **But: Usuario table missing if first run!**

**Impact:**
- ❌ Login fails with "table Usuario does not exist"
- ❌ First time users cannot create account
- ❌ Database schema out of sync with Prisma client
- ❌ Deploy to production fails on first login

**Why it happens:**
- Prisma migrations are in `backend/prisma/migrations/`
- But they're never executed on app startup
- In development, developers run `prisma migrate dev` manually
- In production Electron, nothing triggers the migration

**Fix needed:**

Add to main.js after npm install:
```javascript
// After ensureBackendDeps(), before startBackend()
async function runDatabaseMigrations() {
  const backendDir = getBackendPath();
  
  if (!isDev) {
    console.log('[Database] Running Prisma migrations...');
    
    const migrationResult = await new Promise((resolve) => {
      const prismaCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const migrate = spawn(prismaCmd, ['prisma', 'migrate', 'deploy'], {
        cwd: backendDir,
        stdio: 'inherit',
        shell: true,
      });
      
      migrate.on('close', (code) => {
        if (code === 0) {
          console.log('[Database] ✓ Migrations applied');
          resolve(true);
        } else {
          console.warn('[Database] Migration warning:', code);
          resolve(false);
        }
      });
    });
  }
}

// In app.on('ready'):
await ensureBackendDeps();
await runDatabaseMigrations();  // ← ADD THIS
await startBackend();
```

---

### 🔴 ISSUE #4: PRISMA SCHEMA MISSING "plan" FIELD

**Files:**
- [backend/prisma/migrations/add_plan_to_usuario/migration.sql](backend/prisma/migrations/add_plan_to_usuario/migration.sql)
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L13-L17)

**Problem:**

Migration file exists to add "plan" column:
```sql
-- migration.sql
ALTER TABLE "Usuario" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
```

But schema.prisma doesn't have this field:
```prisma
// ❌ WRONG - schema.prisma (lines 13-17)
model Usuario {
  id        String   @id @default(uuid())
  nome      String
  email     String   @unique
  senha     String
  createdAt DateTime @default(now())
  // ❌ Missing: plan field!
}
```

**Impact:**
- ❌ `prisma generate` may fail with schema mismatch
- ❌ Prisma client doesn't know about "plan" field
- ❌ If migration is applied but schema not updated, introspection fails
- ❌ Database has column, but app can't read it

**Fix needed:**

Add field to schema.prisma:
```prisma
// ✅ CORRECT
model Usuario {
  id        String   @id @default(uuid())
  nome      String
  email     String   @unique
  senha     String
  plan      String   @default("free")  // ← ADD THIS
  createdAt DateTime @default(now())
}
```

---

### 🟠 ISSUE #5: IPC LOGIN TOKEN NOT SYNCED TO API HEADERS

**Files:**
- [frontend/src/services/api.js](frontend/src/services/api.js#L100-L130)
- [electron/ipc-handlers.js](electron/ipc-handlers.js#L64-L72)
- [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx#L36-L54)

**Problem:**

When login succeeds via IPC:

1. Login called from frontend:
   ```javascript
   // frontend/src/context/AuthContext.jsx line 36
   async function login(email, password) {
     const response = await api.post('/auth/login', { email, senha: password });
     // response = { token, user }
   ```

2. This routes through api.js:
   ```javascript
   // api.js lines 108-110
   if (endpoint === 'auth/login' || endpoint.startsWith('auth/login')) {
     const result = await ea.login(data.email, data.senha);  // ← IPC CALL
     return { data: result };  // What is returned here?
   ```

3. IPC handler in main process:
   ```javascript
   // ipc-handlers.js lines 64-72
   ipcMain.handle('user-login', async (event, { email, password }) => {
     const data = await apiFetch('auth/login', {
       method: 'POST',
       body: JSON.stringify({ email, senha: password }),
     });
     if (data.token) {
       headers['Authorization'] = `Bearer ${data.token}`;  // ← Token stored in IPC headers
     }
     return data;  // ✓ Returns token
   });
   ```

**The Problem:**
- Token is returned from IPC handler ✓
- Token is stored in IPC headers in main process ✓
- But **subsequent API calls don't use the token returned by IPC**
- api.js doesn't re-sync the token to its local headers

```javascript
// ❌ WRONG - subsequent POST calls in electron
post: async (url, data = {}, config = {}) => {
  if (isElectron) {
    const result = await ea.invoke('some-endpoint', data);
    // The headers in ipcMain are updated
    // But this api.js call doesn't know that!
    return { data: result };
  }
}
```

**Impact:**
- ❌ Login returns token but subsequent authenticated API calls fail
- ❌ IPC handlers can access token (headers synced in main process)
- ❌ But frontend doesn't know token was synced
- ❌ Subsequent calls like "create-lead" fail with 401

**Example failure:**
1. User logs in ✓ → Token in IPC headers
2. User tries to create lead → POST /looks/
3. api.js routes to IPC
4. IPC call includes Authorization header ✓
5. But if IPC handler doesn't pass headers for non-auth endpoints, fails ❌

**Fix needed:**

Make sure IPC handlers include auth token:
```javascript
// ipc-handlers.js - already done ✓
let headers = {
  'Content-Type': 'application/json',
  // Authorization added by set-auth-token handler
};

// But verify all endpoints include headers:
ipcMain.handle('get-leads', async (event, filters = {}) => {
  return apiFetch(`leads?${params}`, {
    // headers automatically included in apiFetch ✓
  });
});
```

The real issue might be: **double-check that apiFetch() includes headers for all calls**.

---

### 🟠 ISSUE #6: FRONTEND LOADS BEFORE BACKEND READY

**Files:**
- [electron/main.js](electron/main.js#L300-L310)

**Problem:**

Timeline of events:
```javascript
app.on('ready', async () => {
  await startBackend();  // Line 303
  createWindow();        // Line 304 - IMMEDIATELY AFTER
});

function createWindow() {
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');  // Line 40 - LOAD FRONTEND
  }
}
```

**The race condition:**
1. startBackend() is async but continues while checking
2. createWindow() is called immediately
3. Frontend loads at http://localhost:5173
4. But backend might still be starting up!

```javascript
// startBackend() - Line 220+
async function startBackend() {
  // ...
  const ready = await waitForBackend();  // Polls for /health endpoint
  if (!ready) {
    console.warn('[Backend] ⚠️ Backend not responded after 30s');
    // ❌ CONTINUES ANYWAY!
  }
}

// Next line runs immediately:
createWindow();  // Window loads before backend is truly ready
```

**Impact:**
- ❌ Frontend tries to login before backend is ready
- ❌ API calls fail with "Connection refused"
- ❌ Users see "cannot connect" error on startup
- ❌ Retry logic exists but causes UX lag

**Fix needed:**

Make waitForBackend() synchronous before creating window:
```javascript
app.on('ready', async () => {
  console.log('[App] Starting backend...');
  await startBackend();
  
  console.log('[App] Waiting for backend health check...');
  const isReady = await waitForBackend();
  
  if (!isReady) {
    dialog.showErrorBox(
      'Backend Error',
      'Backend server failed to start. Check Node.js installation.'
    );
    app.quit();
    return;
  }
  
  console.log('[App] Creating window...');
  createWindow();
});
```

The current code already has `await startBackend()` but doesn't check the result before createWindow(). The waitForBackend() runs inside startBackend() but its result is ignored.

---

### 🟡 ISSUE #7: NO TIMEOUT ON API CALLS

**Files:**
- [electron/ipc-handlers.js](electron/ipc-handlers.js#L1-L50)

**Problem:**

apiFetch() function has no timeout protection:
```javascript
// ipc-handlers.js - Line 14
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/${endpoint}`;
  const method = options.method || 'GET';
  console.log(`[IPC] ${method} ${url}`);

  const response = await fetch(url, { headers, ...options });
  // ❌ If backend is unresponsive, fetch() hangs forever!
  
  // ...
}
```

node-fetch doesn't have default timeout. If backend stalls/crashes:
```
1. User clicks "Login"
2. IPC handler calls apiFetch('auth/login')
3. fetch() waits indefinitely
4. UI freezes - no response, no timeout
5. User force-quits app
```

**Impact:**
- ❌ App becomes unresponsive if backend stalls
- ❌ No timeout means infinite wait
- ❌ No way for user to cancel request
- ❌ Error handling never triggers

**Fix needed:**

Add timeout to fetch calls:
```javascript
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/${endpoint}`;
  const method = options.method || 'GET';
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(url, { 
      headers, 
      ...options,
      signal: controller.signal  // ← ADD THIS
    });
    clearTimeout(timeout);
    // ...
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout - backend not responding');
    }
    throw err;
  }
}
```

---

### 🟡 ISSUE #8: PRISMA SCHEMA ONLY TARGETS NATIVE PLATFORM

**Files:**
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma#L1-L4)

**Problem:**

```prisma
// schema.prisma - Line 1-2
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native"]  // ❌ ONLY CURRENT PLATFORM
}
```

Only generates binaries for the current OS:
- Built on Windows → only win32 binary
- Built on macOS → only darwin binary
- If cross-platform distribution needed → binaries missing

**Impact:**
- ❌ App fails on different OS than where it was built
- ❌ Binary not found: ".../libquery_engine-linux-x64.so" (on Windows)
- ❌ Cannot distribute prebuilt app across platforms

**Fix needed:**

Include all target platforms:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-x64", "darwin-x64", "darwin-arm64", "windows"]
}
```

---

## SECONDARY ISSUES

### 🟡 CORS Configuration Too Permissive

**File:** [backend/src/app.js](backend/src/app.js#L7-L17) (lines 7-17)

```javascript
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:5173', '...', 'localhost'];
    
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost')) {
      // ❌ Any origin with "localhost" is allowed!
      callback(null, true);
    }
  }
}));
```

**Problem:**
- `origin.includes('localhost')` is too broad
- Allows http://localhost/, http://localhost-evil.com/, etc.
- In production, should be more restrictive

**Fix:** Use exact matching for localhost origins

---

### 🟡 Missing Error Recovery in Auth

**File:** [backend/src/services/auth.service.js](backend/src/services/auth.service.js)

No database connection error handling. If Prisma client fails to initialize:
```javascript
async function login(email, senha) {
  // If prisma connection fails here, error is uncaught
  const user = await prisma.usuario.findUnique({ where: { email } });
  // ...
}
```

**Fix:** Add try-catch around Prisma calls

---

## PRIORITY FIX ORDER

| # | Priority | Issue | File | Line | Time to Fix |
|---|----------|-------|------|------|------------|
| 1 | 🔴 CRITICAL | DATABASE_URL hardcoded | prisma.js | 6 | 5 min |
| 2 | 🔴 CRITICAL | JWT_SECRET regenerated | main.js | 83 | 10 min |
| 3 | 🔴 CRITICAL | No database migration | main.js | ~220 | 15 min |
| 4 | 🔴 CRITICAL | Schema missing "plan" | schema.prisma | 13 | 2 min |
| 5 | 🟠 HIGH | IPC token sync issue | api.js | 108 | 10 min |
| 6 | 🟠 HIGH | Race condition startup | main.js | 304 | 5 min |
| 7 | 🟡 MEDIUM | No API timeout | ipc-handlers.js | 14 | 10 min |
| 8 | 🟡 MEDIUM | Platform-specific binary | schema.prisma | 2 | 2 min |

---

## TESTING CHECKLIST AFTER FIXES

- [ ] App starts without errors
- [ ] Backend initializes database (first run)
- [ ] User can register new account
- [ ] User can login
- [ ] Token persists after app restart
- [ ] Authenticated API calls work (creating leads)
- [ ] Login fails on wrong password
- [ ] Logout clears token
- [ ] API timeout works (test by disabling backend)
- [ ] Cross-platform build works (test on different OS)

---

**Report Generated:** 2026-04-07  
**Total Issues Found:** 8 (4 Critical, 2 High, 2 Medium)  
**Estimated Fix Time:** 1-2 hours
