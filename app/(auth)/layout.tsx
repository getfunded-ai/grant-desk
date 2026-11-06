import Link from "next/link";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Grant Desk
      </Link>
      {children}
    </main>
  );
}
