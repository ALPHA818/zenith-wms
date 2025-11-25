import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
type AppLayoutProps = {
  children: React.ReactNode;
  container?: boolean;
  className?: string;
  contentClassName?: string;
};
export function AppLayout({ children, container = false, className, contentClassName }: AppLayoutProps): JSX.Element {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(() => {
    const stored = localStorage.getItem('autoLogoutEnabled');
    return stored === 'true';
  });

  // Listen for changes to localStorage from other components
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('autoLogoutEnabled');
      setAutoLogoutEnabled(stored === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    const handleLocalUpdate = () => handleStorageChange();
    window.addEventListener('localStorageUpdate', handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdate', handleLocalUpdate);
    };
  }, []);

  // Enable inactivity logout based on setting
  useInactivityLogout(autoLogoutEnabled);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className={className}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <ThemeToggle className="" />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {container ? (
            <div className={"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12" + (contentClassName ? ` ${contentClassName}` : "")}>{children}</div>
          ) : (
            <div className={contentClassName}>{children}</div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}