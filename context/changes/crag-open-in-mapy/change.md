---
change_id: crag-open-in-mapy
title: Open crag in mapy.com from the crag page
status: new
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

In a future version of the app, add an "Open in mapy.com" affordance next to the coordinates on the crag page. Behavior should adapt to the device: launch the mapy.cz / mapy.com native app on phones (via deep link / universal link / intent URL) and open the website in a new tab on desktop. The link's target should center on the crag's stored lat/lng.

Open questions to resolve when planning:

- Confirm the correct mapy.com URL / deep-link scheme for "show point at coordinates" on iOS, Android, and web (and the graceful fallback when the app isn't installed).
- Decide whether the trigger is a button, an icon next to the coordinates, or both — and where it sits visually relative to the existing copy-coordinates / "show on map" affordances.
- Decide if this stays mapy-specific (Polish/Czech audience match) or generalizes to a small set of providers (Google Maps, Apple Maps) the user can pick from. Default assumption: mapy.com only for v1 of this feature, matching the PRD's Polish-first framing.
- Confirm this is purely a public-catalog enhancement (no auth gating, no private state).
