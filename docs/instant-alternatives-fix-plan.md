# Instant alternatives – fix plan

## What “not working” can mean

1. **Section never appears** – User might be on onboarding scan (`fromOnboarding === true`) so the block is hidden.
2. **Always “We couldn’t find better alternatives”** – `getAlternatives` returns `[]` (OFF search empty, or tier filter removes all, or throw → catch sets `[]`).
3. **Loading forever** – `getAlternatives` never resolves (e.g. `lookupProduct` or OFF search hangs; no timeout).
4. **Effect never runs** – Dependency array or timing so we never call `getAlternatives`.

---

## Root causes and fixes

### 1. Effect may not run or may run with stale data

**Current deps:** `[fromOnboarding, result?.barcode ?? result?.food_name ?? "", profile?.goal]`

- If `result` is the same product scanned again, the string is the same so the effect won’t re-run (correct).
- Risk: when the sheet first opens, `profile` might still be `null` (loaded async). We then run with `profile?.goal` undefined. Later when profile loads, effect runs again – OK.
- Fix: add an explicit “result id” so every **new** scan triggers a run: e.g. include `result?.gut_score` in the deps or use a `resultId` like `${result?.barcode ?? result?.food_name}-${result?.gut_score}` so when the same product gets a refreshed result we refetch alternatives once.

**Recommendation:** Keep deps but add a **timeout** so we never hang (see below). Optionally add `result?.gut_score` to deps so when the sheet updates with final scores we re-run once.

### 2. No timeout → loading forever

If `lookupProduct(barcode)` or `searchOFFByTerm(...)` hangs (network, OFF slow), the promise never resolves and the UI stays in “loading”.

**Fix:** Wrap `getAlternatives(result, profile, { maxCount: 3 })` in a timeout (e.g. 12 seconds). On timeout, set `alternatives` to `[]` and show the empty state message.

**Where:** In `scan-content.tsx`, in the effect that calls `getAlternatives`:

```ts
const timeout = setTimeout(() => setAlternatives([]), 12_000);
getAlternatives(result, profile, { maxCount: 3 })
  .then((list) => { clearTimeout(timeout); setAlternatives(list); })
  .catch(() => { clearTimeout(timeout); setAlternatives([]); });
```

### 3. Tier filter too strict → always 0 alternatives

**Current logic:** For bad/medium gut we only keep candidates with `gut_score > current`. If the scanned product is e.g. soda (25) and OFF returns 20 other sodas all scored ~25–30, **all** can be ≤ 25 or only 1–2 above, so we might show 0 or 1 card.

**Fix:** When after tier filter we have **fewer than 3** alternatives, **fallback**: take the top 3 by `gut_score` from **all** candidates (even if not strictly “better”). So we always show up to 3 products when OFF returns any, and only show “couldn’t find” when OFF truly returns 0.

**Where:** `lib/product-alternatives.ts` in `getAlternatives`: after filtering and sorting, if `top.length < maxCount` and `scored.length > 0`, refill from the full sorted list (excluding already chosen).

### 4. Search term or OFF returns 0 products

- **Barcode path:** We call `lookupProduct(barcode)`. If OFF is rate-limited or fails, we get `null` and then use `searchTermFromName(productName)`. So we still have a search term – OK.
- **Search term too narrow:** e.g. “Coca-Cola” might return few or only the same product (then excluded). So we get 0 candidates.

**Fix:** In `getAlternatives`, if `candidates.length === 0`, try a **broader** search term once (e.g. strip brand: “cola” or “soda”, or map “Coca-Cola” → “soft drinks”). Implement a simple fallback: if first search returns 0, try `searchTermFromName` with a shorter or generic term (e.g. first word only, or category map “soda” / “ramen” / “chips”).

**Where:** `lib/product-alternatives.ts`: after first `searchOFFByTerm(searchTerm, 20, excludeBarcode)` if `candidates.length === 0`, set a fallback term (e.g. “snacks” or first word of product name) and call `searchOFFByTerm` again with that; use whichever returns non-empty.

### 5. Ensure section only on home scan

The block is already gated with `{!fromOnboarding && ( ... )}`. Confirm that the **home** scan tab uses `variant="app"` so `fromOnboarding === false`. No code change needed if that’s already the case.

### 6. Optional: reset alternatives when result changes

When the user dismisses the sheet and scans a **different** product, we want a fresh load. Today we set `setAlternatives(null)` at the start of the effect, so when the effect runs for the new result we show loading and refetch. That’s correct as long as the effect runs. Making the dependency include a result identifier (e.g. barcode + food_name) ensures a new product triggers the effect.

---

## Implementation checklist

| # | Task | File(s) |
|---|------|--------|
| 1 | Add 12s timeout around `getAlternatives`; on timeout or reject set `alternatives` to `[]` | `app/scan-content.tsx` |
| 2 | When tier filter yields fewer than 3: fallback to top 3 by gut score from all candidates | `lib/product-alternatives.ts` |
| 3 | If first OFF search returns 0 candidates: try one fallback search term (broader), then use candidates if any | `lib/product-alternatives.ts` |
| 4 | (Optional) Add `result?.gut_score` to effect deps so alternatives refetch when result is updated with final score | `app/scan-content.tsx` |

---

## Summary

- **Reliability:** Timeout so we never show loading forever; fallback to top 3 when tier filter is too strict; optional second search when first returns 0.
- **Visibility:** Section stays home-only (`!fromOnboarding`); no change needed if home uses `variant="app"`.
- **Behavior:** User either sees up to 3 alternative products (with “why better”) or the friendly empty message, never an infinite loading state.
