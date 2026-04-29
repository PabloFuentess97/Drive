import Link from "next/link";

export default function LandingPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "PersonalDrive";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="inline-block h-7 w-7 rounded-lg bg-brand-500" />
          {appName}
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/login" className="rounded-md px-3 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60">
            Sign in
          </Link>
          <Link href="/register" className="rounded-md bg-brand-600 px-3 py-2 text-white hover:bg-brand-700">
            Create account
          </Link>
        </nav>
      </header>

      <section className="my-auto flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Your files. Your server. <span className="text-brand-600">Always with you.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          A self-hosted personal drive built with Next.js, PostgreSQL and a PWA-grade
          offline experience. Upload, organize, preview and share your files without
          relying on third parties.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white shadow hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <footer className="text-center text-sm text-slate-500">
        Built for VPS deployment · Docker-ready · Fully self-hosted
      </footer>
    </main>
  );
}
