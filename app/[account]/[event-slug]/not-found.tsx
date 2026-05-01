export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The booking page you&apos;re looking for doesn&apos;t exist or is no
            longer active.
          </p>
        </div>
      </main>
    </div>
  );
}
