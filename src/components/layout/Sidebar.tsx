"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { label: "All Projects", icon: "dashboard", href: "/projects" },
  { label: "Recent", icon: "schedule", href: "/projects?filter=recent" },
  { label: "Favorites", icon: "star", href: "/projects?filter=favorites" },
];

const workspaceItems = [
  { label: "Team Members", icon: "group", href: "#" },
  { label: "Settings", icon: "settings", href: "#" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col p-6 gap-8">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">
          Dashboard
        </h3>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.label}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  href={item.href}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">
          Workspace
        </h3>
        <ul className="space-y-1">
          {workspaceItems.map((item) => (
            <li key={item.label}>
              <a
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                href={item.href}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto bg-slate-100 dark:bg-slate-900 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary">bolt</span>
          <span className="text-sm font-bold">Pro Plan</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          You have used 85% of your monthly analysis credits.
        </p>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
          <div className="bg-primary w-[85%] h-full rounded-full" />
        </div>
        <button className="text-xs text-primary font-bold hover:underline cursor-pointer">
          Upgrade Plan
        </button>
      </div>
    </aside>
  );
}
