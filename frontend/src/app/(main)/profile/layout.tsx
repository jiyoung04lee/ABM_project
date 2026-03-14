export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen -mt-20 pt-12 bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50">
      {children}
    </div>
  );
}