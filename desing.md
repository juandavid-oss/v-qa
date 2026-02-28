<!-- Video Quality Check Dashboard -->
<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Video Quality Check Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@600;700;800&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#8B5CF6",
                        "background-light": "#F9FAFB",
                        "background-dark": "#0B0A10",
                        "surface-dark": "#16151D",
                        "surface-light": "#FFFFFF",
                        "accent-purple": "#A78BFA",
                    },
                    fontFamily: {
                        display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
                        sans: ["Inter", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "12px",
                        'xl': "16px",
                    },
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        @layer base {
            ::-webkit-scrollbar {
                width: 6px;
            }
            ::-webkit-scrollbar-track {
                background: transparent;
            }
            ::-webkit-scrollbar-thumb {
                background: #2D2B35;
                border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #4B4855;
            }
        }
        .spotify-style-text {
            transition: all 0.3s ease;
        }
        .active-subtitle {
            color: white;
            font-size: 1.25rem;
            line-height: 1.75rem;
            opacity: 1;
            transform: scale(1.02);
        }
        .inactive-subtitle {
            color: rgba(255,255,255,0.3);
            filter: blur(0.5px);
        }
        .mismatch-marker {
            @apply absolute top-0 bottom-0 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] cursor-pointer hover:bg-rose-400 transition-colors z-10;
            width: 4px;
            border-radius: 1px;
        }
        .mismatch-segment {
            @apply absolute top-0 bottom-0 bg-rose-500/30 border-x border-rose-500/50 cursor-pointer hover:bg-rose-500/40 transition-colors z-0;
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans antialiased min-h-screen">
<nav class="border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 py-4 flex items-center justify-between sticky top-0 z-50">
<div class="flex items-center gap-8 flex-1">
<div class="flex items-center gap-2">
<div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
<span class="material-symbols-outlined text-white text-xl">verified</span>
</div>
<span class="font-display font-extrabold text-xl tracking-tight hidden md:block uppercase">V-QA Tool</span>
</div>
<div class="relative max-w-2xl w-full group">
<div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
<span class="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">link</span>
</div>
<input class="block w-full pl-11 pr-32 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-500 text-sm" placeholder="Paste video link here..." type="text" value="https://video-platform.io/f/872e-4b2a-1c9f-3d0a21"/>
<button class="absolute right-2 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-opacity-90 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-primary/20">
                ANALYZE
            </button>
</div>
</div>
<div class="flex items-center gap-4 ml-6">
<button class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
<span class="material-symbols-outlined text-slate-500">notifications</span>
</button>
<div class="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-accent-purple p-[2px]">
<img alt="User Profile" class="h-full w-full rounded-full bg-white dark:bg-slate-900" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjaWIEJWztiN-XDwfWhlAMF8Xdb-Mls-s3P17A5t2in6MmVZjxMj9Qk8H6t6QkIiqgnxJUzdAezafHB5AvT_uWRODo9ng0ePYg4ma1H7UhX-FMs4fWjiPG8WqH-w10aJlW7--JGgdUCbI9ujpChKPHsuLrHQEdoZb1F5qaK_EvjkgipknBeMdWDJO3fO5XhZJ82WeaaO9ivcXHuFhWiViPdEDqZvMcIvMFd7bCBttlCn_mTvi7kYqvTbwRVMvaxYLMxV2i6dqE1F8"/>
</div>
</div>
</nav>
<main class="p-6 max-w-[1600px] mx-auto pb-24">
<div class="grid grid-cols-12 gap-6 mb-6">
<div class="col-span-12 lg:col-span-3 h-[600px] flex flex-col">
<div class="flex items-center justify-between mb-4">
<h2 class="font-display font-bold text-lg flex items-center gap-2">
<span class="material-symbols-outlined text-primary">subtitles</span>
                    Subtitles
                </h2>
<span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Synced</span>
</div>
<div class="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto relative">
<div class="space-y-8 py-20">
<p class="spotify-style-text inactive-subtitle font-bold text-xl">Hey everyone, welcome back to the channel.</p>
<p class="spotify-style-text inactive-subtitle font-bold text-xl">Today we are going to dive into the latest features</p>
<p class="spotify-style-text active-subtitle font-bold text-2xl">of our brand new platform video editing platform.</p>
<p class="spotify-style-text inactive-subtitle font-bold text-xl">We've spent months refining the workflow</p>
<p class="spotify-style-text inactive-subtitle font-bold text-xl">to make sure it's the fastest on the market.</p>
<p class="spotify-style-text inactive-subtitle font-bold text-xl">Let's take a look at the dashboard layout.</p>
<p class="spotify-style-text inactive-subtitle font-bold text-xl text-rose-400/80">First, notice how clean the typography is.</p>
</div>
</div>
</div>
<div class="col-span-12 lg:col-span-6 flex flex-col gap-6">
<div class="flex flex-col h-full">
<div class="flex items-center justify-between mb-4">
<div class="flex items-center gap-2">
<h2 class="font-display font-bold text-lg text-slate-100">Live Preview</h2>
<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
</div>
<div class="flex gap-2">
<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500">1080P / 60FPS</span>
<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 uppercase">00:01:24:12</span>
</div>
</div>
<div class="flex-1 bg-black rounded-t-2xl overflow-hidden relative shadow-2xl group border border-slate-200 dark:border-slate-800 flex flex-col">
<div class="relative flex-1 bg-black">
<img alt="Video frame preview" class="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB180KcnKolLu7f1VKjZWQj9fF6J9i66R5-FAruxu0bXPpSJO2YW0EwhnrBV5UNslzktzfR12v9LPPDTUprl0NoEXKF8YY5ZVqvwdRiflLw9C4NtsooUBHOM5i28VJVcHRboH3G7HeKyqVuLfP6KaLyD5ljQEqV9WdHu8lmOggC1wA_0jciWRiNcFfCjV6mkmFJpNyyCxIo3ZSa-NvhwbKWG26KgOj4uP2w5GF-bPwJp3BF4Y9wG79FPcAntjahnB5xaJEIA--7dBU"/>
<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
<button class="w-16 h-16 bg-primary/90 text-white rounded-full flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
<span class="material-symbols-outlined text-4xl fill-1">play_arrow</span>
</button>
</div>
<div class="absolute top-6 left-6 text-white/50 text-[10px] font-mono uppercase tracking-widest pointer-events-none bg-black/40 px-2 py-1 rounded">
                            PROD_V3_FINAL_SYNC_CHECK.MP4
                        </div>
</div>
</div>
<div class="bg-surface-dark border-x border-b border-slate-800 rounded-b-2xl p-4">
<div class="flex items-center justify-between mb-3">
<div class="flex items-center gap-4">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-white text-lg cursor-pointer hover:text-primary transition-colors">play_arrow</span>
<span class="material-symbols-outlined text-white text-lg cursor-pointer hover:text-primary transition-colors">skip_next</span>
<span class="material-symbols-outlined text-white text-lg cursor-pointer hover:text-primary transition-colors">volume_up</span>
<span class="text-[11px] font-mono text-slate-400 ml-2">01:24 / 04:32</span>
</div>
</div>
<div class="flex items-center gap-3">
<div class="flex items-center gap-1.5 mr-4">
<span class="w-2 h-2 rounded-full bg-rose-500"></span>
<span class="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Mismatch Detected</span>
</div>
<span class="material-symbols-outlined text-slate-400 text-lg cursor-pointer hover:text-white">settings</span>
<span class="material-symbols-outlined text-slate-400 text-lg cursor-pointer hover:text-white">fullscreen</span>
</div>
</div>
<div class="relative h-6 flex items-center group/timeline">
<div class="absolute w-full h-1.5 bg-slate-800 rounded-full"></div>
<div class="absolute h-1.5 bg-primary rounded-full z-10" style="width: 35%;">
<div class="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-75 group-hover/timeline:scale-100 transition-transform cursor-pointer ring-4 ring-primary/20"></div>
</div>
<div class="absolute inset-0 h-full pointer-events-none flex items-center">
<div class="mismatch-segment" style="left: 15%; width: 8%;"></div>
<div class="mismatch-marker" style="left: 15%;"></div>
<div class="mismatch-marker" style="left: 23%;"></div>
<div class="mismatch-segment border-rose-400 bg-rose-500/40" style="left: 34%; width: 4%;"></div>
<div class="mismatch-marker h-4 -top-0.5 bg-white z-20" style="left: 34%;"></div>
<div class="mismatch-marker" style="left: 62%;"></div>
<div class="mismatch-segment" style="left: 85%; width: 5%;"></div>
<div class="mismatch-marker" style="left: 85%;"></div>
</div>
</div>
<div class="flex justify-between mt-1 px-0.5">
<span class="text-[9px] text-slate-600 font-mono">0:00</span>
<span class="text-[9px] text-slate-600 font-mono">1:00</span>
<span class="text-[9px] text-slate-600 font-mono">2:00</span>
<span class="text-[9px] text-slate-600 font-mono">3:00</span>
<span class="text-[9px] text-slate-600 font-mono">4:32</span>
</div>
</div>
</div>
</div>
<div class="col-span-12 lg:col-span-3 h-[600px] flex flex-col">
<div class="flex items-center justify-between mb-4">
<h2 class="font-display font-bold text-lg flex items-center gap-2">
<span class="material-symbols-outlined text-primary">graphic_eq</span>
                    Transcription
                </h2>
<div class="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded uppercase">
<span class="material-symbols-outlined text-[12px] font-bold">check_circle</span>
                    98% Accuracy
                </div>
</div>
<div class="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4">
<div class="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border-l-4 border-primary">
<span class="text-[10px] text-slate-500 mb-1 block uppercase font-bold">Speaker 1 • 01:22</span>
<p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        of our brand new <span class="bg-primary/20 text-primary px-1 rounded">Viral Ideas</span> video editing platform...
                    </p>
</div>
<div class="p-3 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border-l-4 border-slate-200 dark:border-slate-800">
<span class="text-[10px] text-slate-500 mb-1 block uppercase font-bold">Speaker 1 • 01:28</span>
<p class="text-sm leading-relaxed text-slate-400">
                        We've spent months refining the workflow to make sure it's the fastest...
                    </p>
</div>
<div class="p-3 bg-rose-500/5 dark:bg-rose-500/10 rounded-xl border-l-4 border-rose-500">
<div class="flex justify-between items-start mb-1">
<span class="text-[10px] text-rose-400 block uppercase font-bold">Speaker 1 • 01:34</span>
<span class="text-[9px] bg-rose-500 text-white px-1.5 rounded">MISMATCH</span>
</div>
<p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Let's take a look at the dash layout. First, notice how...
                    </p>
<p class="text-[10px] mt-2 text-rose-400 italic">Subtitles say: "dashboard layout"</p>
</div>
</div>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
<div class="flex items-center justify-between mb-6">
<h3 class="font-display font-bold text-lg flex items-center gap-2">
<span class="material-symbols-outlined text-rose-500">spellcheck</span>
                    Spelling &amp; Grammar
                </h3>
<span class="text-xs bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full font-bold">3 Issues Found</span>
</div>
<div class="space-y-4">
<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
<div class="flex gap-4 items-center">
<div class="flex flex-col">
<span class="line-through text-slate-500 text-sm">thier</span>
<span class="text-emerald-500 font-bold text-sm">their</span>
</div>
<div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
<p class="text-xs text-slate-500 italic">"make sure it's thier favorite..."</p>
</div>
<span class="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">01:28:45</span>
</div>
<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
<div class="flex gap-4 items-center">
<div class="flex flex-col">
<span class="line-through text-slate-500 text-sm">editting</span>
<span class="text-emerald-500 font-bold text-sm">editing</span>
</div>
<div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
<p class="text-xs text-slate-500 italic">"...video editting platform..."</p>
</div>
<span class="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">01:22:15</span>
</div>
</div>
</div>
<div class="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
<div class="flex items-center justify-between mb-6">
<h3 class="font-display font-bold text-lg flex items-center gap-2">
<span class="material-symbols-outlined text-primary">sell</span>
                    Brand &amp; Proper Names
                </h3>
<span class="text-xs text-slate-500 font-medium uppercase">Detected in Video</span>
</div>
<div class="flex flex-wrap gap-3">
<div class="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
<div class="w-2 h-2 rounded-full bg-primary"></div>
<span class="text-sm font-bold text-primary">Viral Ideas</span>
<span class="text-[10px] text-slate-400 ml-1">3x</span>
</div>
<div class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-full">
<div class="w-2 h-2 rounded-full bg-slate-400"></div>
<span class="text-sm font-bold">Platform.io</span>
<span class="text-[10px] text-slate-400 ml-1">1x</span>
</div>
<div class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-full">
<div class="w-2 h-2 rounded-full bg-slate-400"></div>
<span class="text-sm font-bold">Network</span>
<span class="text-[10px] text-slate-400 ml-1">5x</span>
</div>
<div class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-full">
<div class="w-2 h-2 rounded-full bg-slate-400"></div>
<span class="text-sm font-bold">AudioStream</span>
<span class="text-[10px] text-slate-400 ml-1">2x</span>
</div>
</div>
<div class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
<div class="flex items-center justify-between text-xs text-slate-500 mb-2 uppercase font-bold tracking-tight">
<span>Analysis Coverage</span>
<span>85%</span>
</div>
<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
<div class="bg-primary w-[85%] h-full"></div>
</div>
</div>
</div>
</div>
</main>
<footer class="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest font-bold z-40">
<div class="flex items-center gap-4">
<span class="flex items-center gap-1.5">
<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            System Operational
        </span>
<span class="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></span>
<span>Last sync: 2 minutes ago</span>
</div>
<div class="flex items-center gap-6">
<span class="hover:text-primary cursor-pointer transition-colors">Documentation</span>
<span class="hover:text-primary cursor-pointer transition-colors">API Status</span>
<span class="flex items-center gap-1">
            Made by <span class="text-primary">Viral Ideas</span>
</span>
</div>
</footer>

</body></html>

<!-- Video Quality Check Dashboard -->
<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Login - V-QA Tool</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@600;700;800&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#8B5CF6",
                        "primary-hover": "#7C3AED",
                        "background-light": "#F9FAFB",
                        "background-dark": "#0B0A10",
                        "surface-dark": "#16151D",
                        "surface-light": "#FFFFFF",
                        "accent-purple": "#A78BFA",
                    },
                    fontFamily: {
                        display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
                        sans: ["Inter", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "12px",
                        'xl': "16px",
                    },
                    backgroundImage: {
                        'grid-pattern': "linear-gradient(to right, #1f1d2b 1px, transparent 1px), linear-gradient(to bottom, #1f1d2b 1px, transparent 1px)",
                    }
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        @layer base {
            body {
                @apply bg-background-dark text-slate-100;
            }
        }
        .bg-grid-overlay {
            background-size: 40px 40px;
            mask-image: linear-gradient(to bottom, transparent, 10%, black, 90%, transparent);
            -webkit-mask-image: linear-gradient(to bottom, transparent, 10%, black, 90%, transparent);
        }
        .glow-effect {
            box-shadow: 0 0 50px -12px rgba(139, 92, 246, 0.25);
        }
    </style>
</head>
<body class="font-sans antialiased min-h-screen flex items-center justify-center relative overflow-hidden">
<div class="absolute inset-0 z-0">
<div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
<div class="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-accent-purple/10 rounded-full blur-[120px] opacity-30"></div>
<div class="absolute inset-0 bg-grid-pattern bg-grid-overlay opacity-20"></div>
<div class="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
<span class="material-symbols-outlined text-[400px]">play_circle</span>
</div>
</div>
<main class="relative z-10 w-full max-w-md p-6">
<div class="bg-surface-dark border border-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 glow-effect flex flex-col items-center">
<div class="mb-10 flex flex-col items-center">
<div class="w-16 h-16 bg-gradient-to-br from-primary to-accent-purple rounded-xl flex items-center justify-center shadow-lg mb-6">
<span class="material-symbols-outlined text-white text-4xl">verified</span>
</div>
<h1 class="font-display font-extrabold text-3xl tracking-tight text-white mb-2 text-center">
                    V-QA TOOL
                </h1>
<p class="text-slate-400 text-sm font-medium text-center">
                    Video Quality Assurance Platform
                </p>
</div>
<div class="w-full space-y-6">
<button class="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3.5 px-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg border border-slate-200">
<svg class="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
</svg>
<span>Sign in with Google</span>
</button>
<div class="relative">
<div class="absolute inset-0 flex items-center">
<div class="w-full border-t border-slate-800"></div>
</div>
<div class="relative flex justify-center text-xs uppercase">
<span class="bg-surface-dark px-2 text-slate-500 font-bold tracking-wider">Secure Access</span>
</div>
</div>
</div>
<div class="mt-8 text-center space-y-4">
<p class="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    By continuing, you agree to our 
                    <a class="text-primary hover:text-primary-hover underline decoration-slate-700 underline-offset-2 transition-colors" href="#">Terms of Service</a>
                    and 
                    <a class="text-primary hover:text-primary-hover underline decoration-slate-700 underline-offset-2 transition-colors" href="#">Privacy Policy</a>.
                </p>
<div class="text-[10px] text-slate-600 font-mono pt-4">
                    V-QA Tool v2.4.0 • Build 8921
                </div>
</div>
</div>
</main>

</body></html>

<!-- Video Quality Check Dashboard -->
<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Projects and Review History - V-QA Tool</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@600;700;800&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#8B5CF6",
                        "primary-dark": "#7c3aed",
                        "background-light": "#F9FAFB",
                        "background-dark": "#0B0A10",
                        "surface-dark": "#16151D",
                        "surface-light": "#FFFFFF",
                        "accent-purple": "#A78BFA",
                    },
                    fontFamily: {
                        display: ["Plus Jakarta Sans", "Inter", "sans-serif"],
                        sans: ["Inter", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "12px",
                        'xl': "16px",
                    },
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        @layer base {
            ::-webkit-scrollbar {
                width: 6px;
            }
            ::-webkit-scrollbar-track {
                background: transparent;
            }
            ::-webkit-scrollbar-thumb {
                background: #2D2B35;
                border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #4B4855;
            }
        }
        .status-badge {
            @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border;
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans antialiased min-h-screen flex flex-col">
<nav class="border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark px-6 py-4 flex items-center justify-between sticky top-0 z-50">
<div class="flex items-center gap-2">
<div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
<span class="material-symbols-outlined text-white text-xl">verified</span>
</div>
<span class="font-display font-extrabold text-xl tracking-tight hidden md:block uppercase">V-QA Tool</span>
</div>
<div class="flex items-center gap-6">
<button class="bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center gap-2">
<span class="material-symbols-outlined text-xl">add</span>
            New Project
        </button>
<div class="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
<div class="flex items-center gap-4">
<button class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
<span class="material-symbols-outlined text-slate-500">notifications</span>
<span class="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-surface-light dark:border-surface-dark"></span>
</button>
<div class="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-accent-purple p-[2px] cursor-pointer">
<img alt="User Profile" class="h-full w-full rounded-full bg-white dark:bg-slate-900 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjaWIEJWztiN-XDwfWhlAMF8Xdb-Mls-s3P17A5t2in6MmVZjxMj9Qk8H6t6QkIiqgnxJUzdAezafHB5AvT_uWRODo9ng0ePYg4ma1H7UhX-FMs4fWjiPG8WqH-w10aJlW7--JGgdUCbI9ujpChKPHsuLrHQEdoZb1F5qaK_EvjkgipknBeMdWDJO3fO5XhZJ82WeaaO9ivcXHuFhWiViPdEDqZvMcIvMFd7bCBttlCn_mTvi7kYqvTbwRVMvaxYLMxV2i6dqE1F8"/>
</div>
</div>
</div>
</nav>
<div class="flex flex-1 overflow-hidden">
<aside class="w-64 bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col p-6 gap-8">
<div>
<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Dashboard</h3>
<ul class="space-y-1">
<li>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold" href="#">
<span class="material-symbols-outlined">dashboard</span>
                        All Projects
                    </a>
</li>
<li>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">
<span class="material-symbols-outlined">schedule</span>
                        Recent
                    </a>
</li>
<li>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">
<span class="material-symbols-outlined">star</span>
                        Favorites
                    </a>
</li>
</ul>
</div>
<div>
<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Workspace</h3>
<ul class="space-y-1">
<li>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">
<span class="material-symbols-outlined">group</span>
                        Team Members
                    </a>
</li>
<li>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors" href="#">
<span class="material-symbols-outlined">settings</span>
                        Settings
                    </a>
</li>
</ul>
</div>
<div class="mt-auto bg-slate-100 dark:bg-slate-900 rounded-xl p-4">
<div class="flex items-center gap-2 mb-2">
<span class="material-symbols-outlined text-primary">bolt</span>
<span class="text-sm font-bold">Pro Plan</span>
</div>
<p class="text-xs text-slate-500 mb-3">You have used 85% of your monthly analysis credits.</p>
<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
<div class="bg-primary w-[85%] h-full rounded-full"></div>
</div>
<button class="text-xs text-primary font-bold hover:underline">Upgrade Plan</button>
</div>
</aside>
<main class="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6 lg:p-10 pb-24">
<header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
<div>
<h1 class="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Projects</h1>
<p class="text-slate-500 dark:text-slate-400">Manage and review your video quality assurance history.</p>
</div>
<div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
<div class="relative group flex-1 md:flex-none">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
<input class="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-500 text-sm" placeholder="Search projects..." type="text"/>
</div>
<button class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-600 dark:text-slate-300">
<span class="material-symbols-outlined text-lg">filter_list</span>
                    Filter
                </button>
<div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
<div class="flex bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl p-1">
<button class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm">
<span class="material-symbols-outlined text-lg">grid_view</span>
</button>
<button class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
<span class="material-symbols-outlined text-lg">view_list</span>
</button>
</div>
</div>
</header>
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<img alt="Project Thumbnail" class="w-full h-full object-cover opacity-80 group-hover:opacity-60 group-hover:scale-105 transition-all duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB180KcnKolLu7f1VKjZWQj9fF6J9i66R5-FAruxu0bXPpSJO2YW0EwhnrBV5UNslzktzfR12v9LPPDTUprl0NoEXKF8YY5ZVqvwdRiflLw9C4NtsooUBHOM5i28VJVcHRboH3G7HeKyqVuLfP6KaLyD5ljQEqV9WdHu8lmOggC1wA_0jciWRiNcFfCjV6mkmFJpNyyCxIo3ZSa-NvhwbKWG26KgOj4uP2w5GF-bPwJp3BF4Y9wG79FPcAntjahnB5xaJEIA--7dBU"/>
<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
<button class="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border border-white/20 rounded-lg px-4 py-2 font-medium text-sm flex items-center gap-2 transition-colors">
                            Open Dashboard <span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-rose-500/10 text-rose-500 border-rose-500/20 backdrop-blur-md">
<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            3 Mismatches
                        </span>
</div>
<div class="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
                        04:32
                    </div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">Product Launch V3</h3>
<p class="text-xs text-slate-500 mt-1">Uploaded 2 hours ago</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">calendar_today</span>
                            Oct 24, 2023
                        </div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">graphic_eq</span>
                            98% Accuracy
                        </div>
</div>
</div>
</div>
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
<span class="material-symbols-outlined text-slate-600 text-6xl">movie</span>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-emerald-500/10 text-emerald-500 border-emerald-500/20 backdrop-blur-md">
<span class="material-symbols-outlined text-sm">check</span>
                            Clean
                        </span>
</div>
<div class="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
                        12:15
                    </div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">Marketing Reel Q4</h3>
<p class="text-xs text-slate-500 mt-1">Uploaded yesterday</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">calendar_today</span>
                            Oct 23, 2023
                        </div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">graphic_eq</span>
                            100% Accuracy
                        </div>
</div>
</div>
</div>
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 flex items-center justify-center">
<span class="material-symbols-outlined text-white/20 text-6xl">play_circle</span>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-amber-500/10 text-amber-500 border-amber-500/20 backdrop-blur-md">
<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Processing
                        </span>
</div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">Tutorial Series: Part 1</h3>
<p class="text-xs text-slate-500 mt-1">Started 5 mins ago</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1.5">
<span>Analyzing Audio</span>
<span>45%</span>
</div>
<div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
<div class="bg-amber-500 w-[45%] h-full rounded-full animate-pulse"></div>
</div>
</div>
</div>
</div>
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
<span class="material-symbols-outlined text-slate-600 text-6xl">smart_display</span>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-rose-500/10 text-rose-500 border-rose-500/20 backdrop-blur-md">
<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            1 Mismatch
                        </span>
</div>
<div class="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
                        01:20
                    </div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">Social Ad _Variant A</h3>
<p class="text-xs text-slate-500 mt-1">Uploaded Oct 20</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">calendar_today</span>
                            Oct 20, 2023
                        </div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">graphic_eq</span>
                            95% Accuracy
                        </div>
</div>
</div>
</div>
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
<span class="material-symbols-outlined text-slate-600 text-6xl">smart_display</span>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-emerald-500/10 text-emerald-500 border-emerald-500/20 backdrop-blur-md">
<span class="material-symbols-outlined text-sm">check</span>
                            Clean
                        </span>
</div>
<div class="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
                        02:45
                    </div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">CEO Interview Cut 2</h3>
<p class="text-xs text-slate-500 mt-1">Uploaded Oct 18</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">calendar_today</span>
                            Oct 18, 2023
                        </div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">graphic_eq</span>
                            100% Accuracy
                        </div>
</div>
</div>
</div>
<div class="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300">
<div class="relative aspect-video bg-slate-900 overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
<span class="material-symbols-outlined text-slate-600 text-6xl">smart_display</span>
</div>
<div class="absolute top-3 right-3">
<span class="status-badge bg-rose-500/10 text-rose-500 border-rose-500/20 backdrop-blur-md">
<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            8 Mismatches
                        </span>
</div>
<div class="absolute bottom-3 left-3 text-white/70 text-[10px] font-mono bg-black/50 backdrop-blur px-2 py-1 rounded">
                        15:00
                    </div>
</div>
<div class="p-5">
<div class="flex justify-between items-start mb-3">
<div>
<h3 class="font-bold text-lg text-slate-900 dark:text-white group-hover:text-primary transition-colors">Webinar Recording Raw</h3>
<p class="text-xs text-slate-500 mt-1">Uploaded Oct 15</p>
</div>
<button class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
<span class="material-symbols-outlined">more_vert</span>
</button>
</div>
<div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">calendar_today</span>
                            Oct 15, 2023
                        </div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-sm">graphic_eq</span>
                            82% Accuracy
                        </div>
</div>
</div>
</div>
</div>
</main>
</div>

</body></html>