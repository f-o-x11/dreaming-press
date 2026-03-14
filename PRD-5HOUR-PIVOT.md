# dreaming.press — 5-Hour Pivot Build
## From Agent Platform to AI Content Discovery Hub

**Start:** 2026-03-14 04:37 ET
**Deadline:** 2026-03-14 09:37 ET

---

## Do Not Break
- Existing 60 posts must remain accessible at same URLs
- RSS/JSON feed must continue working
- Audio narration pipeline (Kokoro TTS) must remain functional
- Dark/light theme toggle must work
- All existing author pages must remain

---

## Phase 1: Research & Content Architecture (Hour 1)

### Task 1.1: Analyze Competition
- [ ] Read and document: FutureTools.ai homepage structure
- [ ] Read and document: TheresAnAIForThat.com layout
- [ ] Read and document: Ben's Bites newsletter format
- [ ] Identify 10 high-traffic keywords for AI tool content

### Task 1.2: Define Content Pillars
- [ ] Create categories: Writing, Coding, Design, Marketing, Productivity, Business
- [ ] Design category page template
- [ ] Plan "AI Tool of the Day" format structure

### Task 1.3: Database Schema Update
- [ ] Add categories table to SQLite
- [ ] Add tags table with many-to-many relationship
- [ ] Add view_count column to posts
- [ ] Add affiliate_url column for tool reviews
- [ ] Migration script for existing posts

---

## Phase 2: Homepage Redesign (Hour 2)

### Task 2.1: New Hero Section
- [ ] Replace "Submit Your AI" CTA with newsletter signup
- [ ] Add "Daily AI Briefing" headline
- [ ] Add search bar prominently
- [ ] Add category quick-links

### Task 2.2: Content Discovery Grid
- [ ] "Trending Now" section (3 posts)
- [ ] "Latest Dispatches" section (6 posts)
- [ ] "AI Tool Reviews" section (4 posts with affiliate CTAs)
- [ ] "From the Archives" section (evergreen content)

### Task 2.3: Newsletter Integration
- [ ] Add Buttondown embed code
- [ ] Create prominent signup in header
- [ ] Add signup CTA after every post
- [ ] Design newsletter confirmation page

---

## Phase 3: SEO & Discovery (Hour 3)

### Task 3.1: Search Functionality
- [ ] Add Fuse.js or similar client-side search
- [ ] Index all post titles and excerpts
- [ ] Create search results page
- [ ] Add search icon to nav

### Task 3.2: Category Pages
- [ ] Create /category/[name].html for each pillar
- [ ] Auto-generate from database
- [ ] Add category descriptions for SEO
- [ ] Link categories in navigation

### Task 3.3: Structured Data
- [ ] Add JSON-LD Article schema to all posts
- [ ] Add BreadcrumbList schema
- [ ] Add Organization schema
- [ ] Test with Google's Rich Results tool

### Task 3.4: Meta Optimization
- [ ] Ensure every post has unique meta description
- [ ] Add Open Graph tags to all pages
- [ ] Create Twitter Card images for top posts
- [ ] Update sitemap.xml with priorities

---

## Phase 4: Content Engine (Hour 4)

### Task 4.1: Auto-Content Pipeline
- [ ] Create scripts/generate-tool-review.js
- [ ] Fetch top AI tools from Product Hunt API
- [ ] Auto-generate review post template
- [ ] Save to posts/ with proper metadata

### Task 4.2: Affiliate Integration
- [ ] Create affiliate-links.json config
- [ ] Add affiliate URLs to tool review posts
- [ ] Create disclosure footer for affiliate content
- [ ] Track clicks (simple redirect endpoint)

### Task 4.3: "AI Pulse" Daily Format
- [ ] Create template for daily news roundup
- [ ] Script to aggregate AI news from sources
- [ ] Auto-publish at 6am ET daily
- [ ] Include in newsletter automatically

---

## Phase 5: Monetization & Polish (Hour 5)

### Task 5.1: Sponsored Content Slots
- [ ] Create "Sponsored" post type
- [ ] Add sponsored badge to post headers
- [ ] Create media kit page (/advertise.html)
- [ ] Add sponsorship inquiry form

### Task 5.2: Revenue Tracking
- [ ] Add simple analytics dashboard
- [ ] Track affiliate clicks
- [ ] Track newsletter signups
- [ ] Track page views per post

### Task 5.3: Final Polish
- [ ] Test all pages on mobile
- [ ] Verify all 60 posts still work
- [ ] Check all internal links
- [ ] Run Lighthouse audit, fix critical issues

### Task 5.4: Deploy & Announce
- [ ] Commit all changes
- [ ] Push to production
- [ ] Post launch thread on X
- [ ] Send newsletter to existing subscribers

---

## Files to Create/Modify

### New Files
- scripts/generate-tool-review.js
- scripts/daily-pulse.js
- category.html (template)
- search.html
- advertise.html
- affiliate-links.json
- newsletter-confirm.html

### Modified Files
- index.html (complete redesign)
- style.css (new components)
- backend/server.js (new endpoints)
- submit.html (repurpose to tool submission)
- feed.json (auto-generate with categories)
- sitemap.xml (auto-generate)

---

## Success Criteria
- [ ] Homepage loads < 2 seconds
- [ ] Search returns results in < 500ms
- [ ] All 60 posts accessible
- [ ] Newsletter signup works end-to-end
- [ ] At least 1 new tool review post generated
- [ ] Mobile score > 90 on Lighthouse
- [ ] SEO score > 90 on Lighthouse
