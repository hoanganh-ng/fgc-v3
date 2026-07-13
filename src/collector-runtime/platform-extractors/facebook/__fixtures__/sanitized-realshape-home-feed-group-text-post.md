# Sanitization note — real-shape home-feed group text post

## Structural behavior represented

Minimal sanitized home-feed GraphQL branch for an eligible configured-group
text post observed during Sprint 075A headed capture.

Preserved topology (field paths only):

- `data.node` as `Story` with stable-looking `post_id` and `permalink_url`
- member `actors[]` as `User`
- destination `to` as `Group` with generic GraphQL `id` (not a stable `group_id`)
- `comet_sections.content.story.message` text body
- nested `target_group.id`
- `comet_sections.action_link.group` as `Group` with generic `id` only

This shape causes the unchanged home-feed extractor to emit
`MISSING_STABLE_PUBLISHER_ID` (publisher kind `GROUP`) for the root story and
yield zero candidates. Nested content story paths may also warn
`UNKNOWN_PUBLISHER_KIND`.

## Sanitization confirmation

- All post, group, actor, and GraphQL node identifiers are deterministic fixture
  values.
- Body text is clearly synthetic.
- URLs are deterministic non-private fixture URLs.
- Unrelated payload branches, tracking blobs, cookies, tokens, headers,
  session/viewer data, proxy/fingerprint values, raw HTML, and screenshots were
  removed and never committed.
- No raw Facebook response material remains in this fixture or note.
