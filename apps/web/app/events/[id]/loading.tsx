import { Header } from "../../components/Header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="h-5 w-36 rounded bg-stone-200" />
          <div className="mt-3 h-12 w-2/3 rounded bg-stone-200" />
          <div className="mt-6 h-24 rounded bg-stone-200" />
        </section>
        <aside className="h-80 rounded-lg bg-stone-200" />
      </main>
    </div>
  );
}
