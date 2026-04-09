// Intentional empty stub used by apps/server/build.mjs to replace database
// packages (drizzle-orm, postgres) at bundle time. The packaged desktop app
// runs in in-memory mode and never imports these modules at runtime.
//
// This is a CommonJS module so esbuild treats the namespace as fully dynamic
// and allows any named import to succeed (they all resolve to `stub`, which
// throws a clear error if anyone ever actually calls them).

function makeStub() {
  const err = () => {
    throw new Error(
      '[conflict-game] Database-backed code path invoked in a build that ' +
      'intentionally stubs out drizzle-orm / postgres. Use the in-memory ' +
      'mode (leave DATABASE_URL unset) in the packaged desktop build.'
    );
  };
  const handler = {
    get(target, prop) {
      if (prop === '__esModule') return true;
      if (prop === Symbol.toPrimitive) return () => '[stub]';
      if (prop === 'default') return target;
      return target;
    },
    apply() { return new Proxy(err, handler); },
    construct() { return new Proxy(err, handler); },
  };
  return new Proxy(err, handler);
}

module.exports = makeStub();
