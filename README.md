# GST Company Lookup — Prototype

Fetch company details from a GSTIN using the [Sandbox.co.in](https://sandbox.co.in) GST Compliance API. Includes a CLI script for quick testing and an Express backend with an auto-fill frontend form.

---

## How it works

1. User enters a 15-character GSTIN
2. Format is validated locally via regex (no API call wasted on bad input)
3. Backend authenticates with Sandbox to get a short-lived token
4. Token is used to call the GSTIN search endpoint
5. Company name, address, status, and constitution are returned and mapped to form fields

---

## Project structure

```
├── index.js          # CLI script — quick terminal test
├── server.js         # Express server with POST /api/gst-lookup
├── public/
│   └── index.html    # Auto-fill form (served by Express)
├── .env              # API credentials (not committed)
├── .gitignore
└── package.json
```

---

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Create `.env`**
```env
API_KEY=your_sandbox_api_key
API_SECRET=your_sandbox_api_secret
BASE_URL=https://api.sandbox.co.in
PORT=3000
```

Get credentials from [console.sandbox.co.in](https://console.sandbox.co.in) → Settings → API Keys.

---

## Usage

### CLI (quick test)
```bash
node index.js 24ABKCS2033B1ZV
```

### Server + Form
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) and type a GSTIN into the TAX ID field.

---

## API

### `POST /api/gst-lookup`

**Request**
```json
{ "gstin": "24ABKCS2033B1ZV" }
```

**Response**
```json
{
  "gstin": "24ABKCS2033B1ZV",
  "companyName": "SANDBOX FINANCIAL TECHNOLOGIES PRIVATE LIMITED",
  "tradeName": "SANDBOX FINANCIAL TECHNOLOGIES PRIVATE LIMITED",
  "status": "Active",
  "constitution": "Private Limited Company",
  "businessType": "Regular",
  "registrationDate": "06/02/2023",
  "addressLine1": "B 701, Lakeview Towers",
  "addressLine2": "7TH FLOOR, VASTRAPUR",
  "city": "Ahmedabad",
  "state": "Gujarat",
  "pincode": "380015"
}
```

**Errors**

| Status | Reason |
|--------|--------|
| 400 | Missing or invalid GSTIN format |
| 404 | GSTIN not found |
| 500 | Sandbox API error |

---

## Field mapping (Sandbox API → form)

| Sandbox field | Form field |
|---|---|
| `lgnm` | Company Name |
| `sts` | Status |
| `ctb` | Constitution |
| `dty` | Business Type |
| `rgdt` | Registration Date |
| `pradr.addr.bno + bnm` | Address Line 1 |
| `pradr.addr.flno + st` | Address Line 2 |
| `pradr.addr.loc` | City |
| `pradr.addr.stcd` | State |
| `pradr.addr.pncd` | Pin Code |

---

## Auth flow (Sandbox)

Sandbox requires a two-step auth — credentials do not go directly on API calls.

```
POST /authenticate
  headers: x-api-key, x-api-secret, x-api-version: 1.0.0
  → returns access_token (valid 24hrs)

POST /gst/compliance/public/gstin/search
  headers: x-api-key, authorization: <token> (no Bearer prefix), x-api-version: 1.0
  body: { gstin }
```

The server caches the token in memory for 23 hours and re-fetches only when it expires.

---

## Next steps (when rebuilding in Go)

- Same two endpoints, same headers, same field mapping
- Replace in-memory token cache with Redis or a DB-backed store
- Add response caching per GSTIN (details rarely change — save API credits)
- Wire into the real B2B onboarding form