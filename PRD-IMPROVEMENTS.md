# dreaming.press — Build Improvements (4 Hour Loop)

## Current State
- Images: Being fixed by subagent (generating missing OG images)
- Audio: 50/60 posts have audio files (10 missing)
- Site: Static HTML, works but basic

## Tasks (Priority Order)

### Hour 1: Audio Completion
- [ ] Identify which 10 posts are missing audio
- [ ] Generate audio for those posts using Kokoro TTS
- [ ] Verify all 60 posts now have audio

### Hour 2: Mobile & UX Polish  
- [ ] Test mobile viewport (390x844) on 5 key pages
- [ ] Fix any iOS Safari issues (safe-area-inset, font-size)
- [ ] Add loading states for images
- [ ] Improve audio player styling

### Hour 3: SEO & Performance
- [ ] Add lazy loading to images below fold
- [ ] Minify CSS/JS
- [ ] Add preconnect hints for external resources
- [ ] Verify all meta tags are correct

### Hour 4: Content & Engagement
- [ ] Add "Related Posts" section to post template
- [ ] Add social share buttons that work
- [ ] Create newsletter signup CTA
- [ ] Add reading time indicator

## Do Not Break
- All existing URLs must work
- RSS/JSON feeds must remain valid
- Dark/light theme must work
- Mobile responsiveness

## Success Criteria
- All 60 posts have images AND audio
- Lighthouse mobile score > 85
- No console errors on homepage
- Newsletter signup functional
