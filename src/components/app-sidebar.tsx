import React from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Warehouse,
  ClipboardList,
  Briefcase,
  MapPin,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Permission } from "@shared/types";
interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  permission?: Permission;
}
const navItems: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/inventory", icon: Boxes, label: "Inventory" },
  { href: "/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/shipments", icon: Truck, label: "Shipments" },
  { href: "/locations", icon: MapPin, label: "Locations", permission: 'manage:locations' },
  { href: "/job-cards", icon: ClipboardList, label: "Job Cards" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/reports", icon: BarChart3, label: "Reports", permission: 'view:reports' },
  { href: "/settings", icon: Settings, label: "Settings", permission: 'manage:users' },
];
export function AppSidebar(): JSX.Element {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const userPermissions = user?.permissions || [];
  const hasPermission = (permission?: Permission) => {
    if (!permission) return true; // Public route
    return userPermissions.includes(permission);
  };
  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1">
          <Warehouse className="h-7 w-7 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Zenith WMS</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) =>
            hasPermission(item.permission) ? (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.href}
                  className={cn(
                    "justify-start transition-all duration-200",
                    "hover:bg-accent hover:text-accent-foreground",
                    location.pathname === item.href && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  )}
                >
                  <Link to={item.href}>
                    <item.icon className="mr-3 h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}