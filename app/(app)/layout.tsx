import { BottomNav } from "../components/BottomNav";

export default function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="mx-auto grid max-w-lg gap-4 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
