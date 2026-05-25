# SendLog - MVP ideas

## Core Problem
Climbers have no easy way to track which routes they've climbed at local crags or add personal notes about beta, gear, or conditions. Existing apps like Mountain Project or TheCrag are great for public topos but don't offer a simple, private space to log personal ascents and memories.

## Minimum Feature Set (MVP)

### Content Management (Strapi - Admin only)
- Admin can add one region (e.g., "Sokoliki") with 2-3 crags via Strapi admin panel
- Each crag contains 5-10 routes with basic info: name, grade, type (trad/sport), year set
- Strapi auto-generates REST API endpoints for routes (public, no auth required)

### User Features (Supabase - End users)
- User accounts (register/login) via Supabase Auth
- Logged-in users can mark routes as "climbed" with personal data:
    - Date climbed
    - Personal grade (optional, user's subjective rating)
    - Text notes (beta, gear used, conditions)
- Users can add routes to "projects" (routes they want to climb in the future)
- Users can favorite routes
- Users can add public comments on routes (visible to all logged-in users)
- Personal history page showing climbed routes, projects, and favorites

### Map Integration
- Display crags on an interactive map using Mapy.com API
- Clicking a map pin shows the crag's routes

## What's NOT in MVP Scope
- User-submitted routes or crags (only admin can add content initially - Strapi handles this)
- Social features (sharing climbed lists, following other users, public profiles)
- Advanced filters (search by grade, type, etc. - just visual browsing on map + crag view)
- Offline mode or mobile apps (responsive web only)
- Photo uploads for route notes (text-only MVP)
- Integration with external climbing databases (UKC, Mountain Project, TheCrag)
- Complex analytics or climbing stats (yearly totals, grade progression - maybe post-MVP)

## Success Criteria
- Logged-in user can mark a route as climbed and save a note in under 30 seconds
- Admin can add a new crag with 5 routes in under 10 minutes via Strapi admin panel
- Map displays crag locations correctly using Mapy.com API
- 90% of test users understand the core value immediately: "track my climbs with personal notes"