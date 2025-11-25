import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { DashboardStatsCard } from "@/components/wms/DashboardStatsCard";
import { 
  DollarSign, 
  Package, 
  PackageX, 
  Truck, 
  Boxes,
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Settings,
  ClipboardList,
  Briefcase,
  MapPin,
  MessageSquare,
  Users,
} from "lucide-react";
import { DashboardStats, Permission } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
interface NavCard {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  permission?: Permission;
}

const navCards: NavCard[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", description: "Overview of operations" },
  { href: "/inventory", icon: Boxes, label: "Inventory", description: "Manage product stock" },
  { href: "/orders", icon: ShoppingCart, label: "Orders", description: "Track and process orders" },
  { href: "/shipments", icon: Truck, label: "Shipments", description: "Monitor deliveries" },
  { href: "/locations", icon: MapPin, label: "Locations", description: "Warehouse locations", permission: 'manage:locations' },
  { href: "/job-cards", icon: ClipboardList, label: "Job Cards", description: "Task assignments" },
  { href: "/jobs", icon: Briefcase, label: "Jobs", description: "Job management" },
  { href: "/chat", icon: MessageSquare, label: "Chat", description: "Team communication" },
  { href: "/groups", icon: Users, label: "Groups", description: "User groups", permission: 'manage:users' },
  { href: "/reports", icon: BarChart3, label: "Reports", description: "Analytics and insights", permission: 'view:reports' },
  { href: "/settings", icon: Settings, label: "Settings", description: "System configuration", permission: 'manage:users' },
];

export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.permissions?.includes('manage:users') ?? false;
  const userPermissions = user?.permissions || [];

  const hasPermission = (permission?: Permission) => {
    if (!permission) return true;
    return userPermissions.includes(permission);
  };
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await api<DashboardStats>('/api/wms/stats');
        setStats(data);
      } catch (error) {
        toast.error("Failed to load dashboard stats.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  return (
    <AppLayout container>
      <PageHeader title="Dashboard" subtitle="A high-level overview of your food warehouse operations." />
      
      {/* Stats Section */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading || !stats ? (
          <>
            {isAdmin && <Skeleton className="h-[126px] rounded-lg" />}
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
          </>
        ) : (
          <>
            {isAdmin && (
              <DashboardStatsCard
                title="Total Inventory Value"
                value={formatCurrency(stats.totalInventoryValue)}
                description="+20.1% from last month"
                icon={<DollarSign className="h-5 w-5" />}
                href="/inventory"
              />
            )}
            <DashboardStatsCard
              title="Total Inventory Amount"
              value={(stats.totalInventoryAmount || 0).toLocaleString()}
              description="Total units in stock"
              icon={<Boxes className="h-5 w-5" />}
              href="/inventory"
            />
            <DashboardStatsCard
              title="Pending Orders"
              value={`+${stats.pendingOrders}`}
              description="Awaiting processing"
              icon={<Package className="h-5 w-5" />}
              href="/orders"
            />
            <DashboardStatsCard
              title="Out of Stock Items"
              value={`${stats.outOfStockItems}`}
              description="Needs immediate restocking"
              icon={<PackageX className="h-5 w-5" />}
              href="/inventory"
            />
            <DashboardStatsCard
              title="Shipments In-Transit"
              value={`+${stats.shipmentsInTransit}`}
              description="Currently on the way"
              icon={<Truck className="h-5 w-5" />}
              href="/shipments"
            />
          </>
        )}
      </div>

      {/* Navigation Cards Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Quick Access</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {navCards.map((item) =>
            hasPermission(item.permission) ? (
              <Link key={item.href} to={item.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{item.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ) : null
          )}
        </div>
      </div>

      <Toaster richColors />
    </AppLayout>
  );
}