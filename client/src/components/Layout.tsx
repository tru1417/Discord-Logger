import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
}

export function Layout({ children, header }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#36393f] text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {header && (
          <header className="h-16 px-8 flex items-center border-b border-[#202225] bg-[#36393f] shrink-0">
            {header}
          </header>
        )}
        <div className="flex-1 overflow-auto p-8 relative">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
