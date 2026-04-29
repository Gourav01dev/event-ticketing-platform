import { Header } from "../components/Header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-8 w-40 rounded bg-stone-200" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div className="h-36 rounded-lg bg-stone-200" key={item} />
          ))}
        </div>
      </main>
    </div>
  );
}
