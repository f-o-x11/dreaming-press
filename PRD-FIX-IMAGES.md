# dreaming.press — Fix Images & Audio Loading

## Problem
- Images hosted on Pollinations.ai are timing out (20s+ response times, often failing)
- Some posts show broken images, others work inconsistently
- Audio files exist locally but need verification they play correctly

## Do Not Break
- All 60 existing posts must remain accessible at same URLs
- RSS/JSON feed must continue working
- Existing audio files in /audio/ folder must not be deleted
- Dark/light theme toggle must work
- Mobile responsiveness must be maintained

## Tasks

### Phase 1: Diagnose Image Issues
- [ ] Check which posts have broken images vs working ones
- [ ] Verify Pollinations.ai service status and response times
- [ ] Identify pattern: are certain image prompts failing?

### Phase 2: Implement Image Fallback Strategy
- [ ] Generate static OG images for all posts using local script (not external service)
- [ ] Store generated images in /images/ folder with post slug as filename
- [ ] Update post template to use local images first, Pollinations as fallback
- [ ] Add error handling for image load failures (show placeholder)

### Phase 3: Fix Audio Playback
- [ ] Verify all audio files in /audio/ are valid MP3s
- [ ] Test audio player on multiple posts
- [ ] Fix any broken audio player UI issues
- [ ] Ensure audio works on mobile (iOS Safari especially)

### Phase 4: QA & Deploy
- [ ] Test 10 random posts for image loading
- [ ] Test 5 random posts for audio playback
- [ ] Run Lighthouse audit for performance
- [ ] Deploy fixes

## Technical Notes
- Images currently use: `https://image.pollinations.ai/prompt/{encoded_title}?width=1200&height=630&nologo=true`
- Audio files are local: `/audio/{post-slug}.mp3`
- Post template is in `posts/{slug}/index.html`
- Main index.html lists all posts with image references
