import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  return (
    <div className="font-sans antialiased min-h-screen flex items-center justify-center relative overflow-hidden bg-background-dark">
      {/* Background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-40" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-accent-purple/10 rounded-full blur-[120px] opacity-30" />
        <div className="absolute inset-0 bg-grid-overlay opacity-20" />
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <span className="material-symbols-outlined text-[400px]">play_circle</span>
        </div>
      </div>

      {/* Login card */}
      <main className="relative z-10 w-full max-w-md p-6">
        <div className="bg-surface-dark border border-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 glow-effect flex flex-col items-center">
          {/* Logo */}
          <div className="mb-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent-purple rounded-xl flex items-center justify-center shadow-lg mb-6">
              <span className="material-symbols-outlined text-white text-4xl">verified</span>
            </div>
            <h1 className="font-display font-extrabold text-3xl tracking-tight text-white mb-2 text-center">
              V-QA TOOL
            </h1>
            <p className="text-slate-400 text-sm font-medium text-center">
              Video Quality Assurance Platform
            </p>
          </div>

          {/* Sign in button */}
          <div className="w-full space-y-6">
            <GoogleSignInButton />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-dark px-2 text-slate-500 font-bold tracking-wider">
                  Secure Access
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              By continuing, you agree to our{" "}
              <a className="text-primary hover:text-primary-hover underline decoration-slate-700 underline-offset-2 transition-colors" href="#">
                Terms of Service
              </a>{" "}
              and{" "}
              <a className="text-primary hover:text-primary-hover underline decoration-slate-700 underline-offset-2 transition-colors" href="#">
                Privacy Policy
              </a>
              .
            </p>
            <div className="text-[10px] text-slate-600 font-mono pt-4">
              V-QA Tool v1.0.0
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
