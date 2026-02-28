"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import ProjectCard from "@/components/projects/ProjectCard";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import { useProjects } from "@/hooks/useProjects";

export default function ProjectsPage() {
  const { projects, loading, createProject } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6 lg:p-10 pb-24">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">
                Projects
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Manage and review your video quality assurance history.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:flex-none">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  search
                </span>
                <input
                  className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-500 text-sm"
                  placeholder="Search projects..."
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                <span className="material-symbols-outlined text-lg">filter_list</span>
                Filter
              </button>
              <button
                onClick={() => setDialogOpen(true)}
                className="bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                New Project
              </button>
            </div>
          </header>

          {/* Project grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Loading projects...</p>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-600">
                  video_library
                </span>
                <h3 className="text-xl font-bold text-slate-400">No projects yet</h3>
                <p className="text-slate-500 text-sm max-w-sm">
                  Create your first project by clicking the &quot;New Project&quot; button and pasting a Frame.io URL.
                </p>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="mt-4 bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  New Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </main>
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={createProject}
      />
    </div>
  );
}
