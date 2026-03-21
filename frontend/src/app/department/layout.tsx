import Header from "@/shared/components/layout/Header";

export default function DepartmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}