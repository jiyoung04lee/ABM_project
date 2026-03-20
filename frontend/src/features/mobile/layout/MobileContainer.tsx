"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function MobileContainer({ children, className = "" }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 md:hidden">
      <div className={`mx-auto w-full max-w-md px-4 pb-8 ${className}`}>
        {children}
      </div>
    </div>
  );
}