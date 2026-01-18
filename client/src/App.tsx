import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Logs from "@/pages/Logs";
import Cases from "@/pages/Cases";
import Rules from "@/pages/Rules";
import Roles from "@/pages/Roles";

function Router() {
  return (
    <div className="flex min-h-screen bg-[#36393f] text-gray-100 font-sans">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen relative z-10">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/logs" component={Logs} />
          <Route path="/cases" component={Cases} />
          <Route path="/rules" component={Rules} />
          <Route path="/roles" component={Roles} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
