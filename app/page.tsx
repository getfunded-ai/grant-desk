export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Grant Desk · working name</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        Open-source grant management for nonprofit grant seekers
      </h1>
      <p className="text-lg text-muted-foreground">
        Find, track, win and report on grants from foundations, companies, cities, counties, states
        and the federal government. Free to use. Open source. Built in the open, one phase at a
        time.
      </p>
      <p className="rounded-lg border bg-card p-4 text-sm text-card-foreground">
        Phase A of 26. There is no sign-in and no database yet. The plan is in{" "}
        <code className="rounded bg-muted px-1 py-0.5">ROADMAP.md</code>.
      </p>
    </main>
  );
}
