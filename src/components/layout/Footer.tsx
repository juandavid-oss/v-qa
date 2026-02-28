export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold z-40">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          System Operational
        </span>
        <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
        <span>Last sync: 2 minutes ago</span>
      </div>
      <div className="flex items-center gap-6">
        <span className="hover:text-primary cursor-pointer transition-colors">Documentation</span>
        <span className="hover:text-primary cursor-pointer transition-colors">API Status</span>
        <span className="flex items-center gap-1">
          Made by <span className="text-primary ml-1">Viral Ideas</span>
        </span>
      </div>
    </footer>
  );
}
