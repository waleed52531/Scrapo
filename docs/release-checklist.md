# Release checklist

Before each production release:

- [ ] CI green
- [ ] migrations reviewed
- [ ] backup available
- [ ] staging tested
- [ ] web builds
- [ ] API builds
- [ ] worker builds
- [ ] security checks pass
- [ ] no secret changes forgotten
- [ ] Swagger/OpenAPI updated
- [ ] Postman collection updated when practical
- [ ] production smoke test plan ready
- [ ] rollback plan understood

Release notes format:

```text
Added
Changed
Fixed
Migration
Manual Actions Required
```
