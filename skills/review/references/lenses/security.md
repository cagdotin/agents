# Security

## What to look for
- Untrusted input crossing trust boundaries without validation or escaping
- Missing or misplaced authentication and authorization checks
- Secrets, tokens, or sensitive data exposed in code, logs, or responses
- Unsafe parsing, deserialization, file access, or command execution
- Overly broad permissions, defaults, or data exposure
- Security-relevant changes hidden inside seemingly routine refactors

## Questions to ask
- What input here is attacker-controlled or externally influenced?
- Where is validation happening, and is it happening soon enough?
- Are auth checks enforced on the trusted side of the boundary?
- Could this change leak secrets or sensitive internal state?
- Does the failure mode become more permissive than intended?

## Common patterns to flag
- String interpolation into queries, shells, paths, templates, or HTML
- Client-side-only auth checks for sensitive operations
- Logging full tokens, payloads, credentials, or personal data
- Deserializing or evaluating data from untrusted sources
- Path traversal or file access built from unchecked user input
- "Temporary" debug backdoors or permissive defaults left in place

## Context to gather
- Review the nearest trust boundary and data flow around the change
- Check existing auth, validation, and secret-handling patterns nearby
- Compare with similar security-sensitive code in the repository
- Be explicit about the exploit path or misuse case when raising a concern
