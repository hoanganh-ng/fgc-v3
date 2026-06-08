# Sanitized Facebook Payload Fixtures

These fixtures are sanitized Facebook GraphQL response-body samples used only by extractor tests. They preserve the response shape needed by the parser while replacing real account, post, comment, and group values with safe placeholders.

Raw Facebook payloads must not be committed. Before adding or updating fixtures, remove tokens, cookies, viewer data, auth/session fields, tracking fields, CDN-token query parameters, request headers, and private identifiers.
