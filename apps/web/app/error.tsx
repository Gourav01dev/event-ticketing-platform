"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <section className="max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold text-stone-950">
          Something went wrong
        </h1>
        <p className="mt-3 text-stone-600">{error.message}</p>
        <button
          className="mt-6 rounded-md bg-teal-700 px-4 py-2 font-medium text-white"
          onClick={reset}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
