// Loaded via `node --import tsx --import ./tests/setup.ts` before any test
// module. lib/db throws at import time without DATABASE_URL, and many pure
// modules import it transitively (legal -> billing -> db). The pg Pool is
// lazy, so a dummy URL is enough to import those modules; any test that
// actually issues a query would fail loudly with ECONNREFUSED rather than
// silently talking to a real database.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
