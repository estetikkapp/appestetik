export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-brand-700">appestetika</h1>
      <p className="mt-4 text-brand-500">Sprint 1a — scaffolding</p>
      <button className="mt-8 rounded-lg bg-brand-500 px-6 py-3 text-white hover:bg-brand-600 transition">
        Botón de prueba (brand-500)
      </button>
      <button className="mt-4 rounded-lg bg-gold-500 px-6 py-3 text-white hover:bg-gold-600 transition">
        Botón premium (gold-500)
      </button>
    </main>
  );
}
