# 2026-11-17 — A request with no parsed JSON body now returns 400, not 500 (all modules)

**Scope:** every validated write endpoint in the API — all modules, not one feature.
**Type:** error-response change on a malformed request. **No correct request changes behaviour.**
**Action required of the frontend:** none, if you already send `Content-Type: application/json` on
every request that carries a body. One case is worth checking: **`DELETE` requests that send a
body.** See §3.

---

## 1. What changed

A single change in the shared request validator (`src/common/utilities/validator.utils.js`):
when a request arrives with **no parsed body**, it is now validated as if the client had sent `{}`,
which produces the normal `400 VALIDATION_ERROR` naming the missing field.

Before, such a request produced:

```json
{ "success": false, "message": "Cannot destructure property 'reason' of 'undefined'...",
  "errorCode": "INTERNAL_ERROR" }
```

with HTTP **500**. Now it produces, for example:

```json
{ "success": false, "message": "Reason is required for this operation",
  "errorCode": "VALIDATION_ERROR" }
```

with HTTP **400**.

## 2. Why it happened

The backend runs Express 5, which **no longer guarantees `req.body`**. `express.json()` assigns it
only when it actually parsed a JSON body, so a request with no body — or any `Content-Type` other
than `application/json` — reached the handler with `req.body === undefined`. The validator passed
`undefined` through unchallenged (an object schema treats the object itself as optional and only its
keys as required), the handler then destructured it, and the resulting `TypeError` surfaced as a
500. Under Express 4 the same request produced `{}` and a tidy 400, which is why this only appeared
after the Express 5 upgrade.

## 3. The one case worth checking in the client

**`DELETE` endpoints that take a body.** Many HTTP clients omit `Content-Type` for `DELETE` by
default, and some omit the body entirely unless told otherwise. Any such call was getting a 500 and
is now getting a 400 — but either way **the request was never carried out**, so if a delete seemed
to fail for no reason, this was why. Send the header explicitly:

```js
fetch(url, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ reason })
})
```

The same applies to `POST`/`PATCH`/`PUT` calls built without a body (for example an action endpoint
whose payload later became optional in the UI but required on the server).

## 4. What did **not** change

* Any request that already sent a valid JSON body — the overwhelming majority — behaves identically.
  Unknown-key stripping, type coercion, schema defaults, the error envelope and the choice of which
  message is reported are all unchanged, and are now pinned by tests.
* No endpoint, field, status code or payload shape was added, removed or renamed.
* `req.query` and `req.params` are never absent in Express, so **GET** endpoints are unaffected.

## 5. If you were relying on the 500

You were not able to: the request had already failed. The change only replaces a misleading
`INTERNAL_ERROR` with the accurate `VALIDATION_ERROR` your error handling already understands. If
your client special-cases 500 with a retry, those retries were never going to succeed and can now
be driven by the 400 instead.
