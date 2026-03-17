// app/network/write_net/layout.tsx

export default function WriteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col">
      {children}
    </div>
  );
}