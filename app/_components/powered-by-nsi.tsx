// app/_components/powered-by-nsi.tsx
// Phase 17 (PUB-04): "Powered by North Star Integrations" attribution footer.
// Used by PublicShell on every public booking surface AND inside EmbedShell.
// Text-only — final NSI mark image deferred to v1.3 (PROJECT.md Out of Scope).

export function PoweredByNsi() {
  return (
    <footer className="py-8 text-center">
      <p className="text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://nsintegrations.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          North Star Integrations
        </a>
      </p>
    </footer>
  );
}
