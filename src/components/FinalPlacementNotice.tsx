export default function FinalPlacementNotice({ program, isPlacementWeek }: { program?: string; isPlacementWeek: boolean }) {
  if (!program?.startsWith("2nd-") || !isPlacementWeek) return null;

  return (
    <aside className="my-4 flex min-h-[55vh] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 print:min-h-[60vh] print:border-slate-300 print:bg-white print:text-slate-900">
      <p className="text-2xl font-extrabold sm:text-3xl">No Classes This Week — Final Placement Week.</p>
      <p className="mt-3 max-w-2xl text-base sm:text-lg">Wishing everyone confidence, success, and the offer they’re hoping for!</p>
    </aside>
  );
}
