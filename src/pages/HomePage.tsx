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
  PackageOpen,
  CheckCircle,
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
  { href: "/qc", icon: CheckCircle, label: "QC", description: "Quality control inspections", permission: 'manage:qc' },
  { href: "/inventory", icon: Boxes, label: "Inventory", description: "Manage product stock" },
  { href: "/orders", icon: ShoppingCart, label: "Orders", description: "Track and process orders" },
  { href: "/shipments", icon: Truck, label: "Shipments", description: "Monitor deliveries" },
  { href: "/locations", icon: MapPin, label: "Locations", description: "Warehouse locations", permission: 'manage:locations' },
  { href: "/pallet-prod", icon: Package, label: "PalletProd", description: "Finished product pallets" },
  { href: "/pallet-raw", icon: PackageOpen, label: "PalletRaw", description: "Raw material pallets" },
  { href: "/job-cards", icon: ClipboardList, label: "Job Cards", description: "Task assignments" },
  { href: "/jobs", icon: Briefcase, label: "Jobs", description: "Job management" },
  { href: "/chat", icon: MessageSquare, label: "Chat", description: "Team communication" },
  { href: "/groups", icon: Users, label: "Groups", description: "User groups", permission: 'manage:users' },
  { href: "/reports", icon: BarChart3, label: "Reports", description: "Analytics and insights", permission: 'view:reports' },
  { href: "/settings", icon: Settings, label: "Settings", description: "System configuration", permission: 'manage:users' },
];

export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    try {
      const cached = localStorage.getItem('zenith:lastStats');
      return cached ? (JSON.parse(cached) as DashboardStats) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => stats == null);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.permissions?.includes('manage:users') ?? false;
  const userPermissions = user?.permissions || [];

  const hasPermission = (permission?: Permission) => {
    if (!permission) return true;
    return userPermissions.includes(permission);
  };
  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        if (!stats) setLoading(true);
        const timestamp = Date.now();
        // Add a timeout so the UI doesn't hang if dev worker is slow
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const data = await api<DashboardStats>(`/api/wms/stats?_=${timestamp}`, { signal: controller.signal as any });
        clearTimeout(timeoutId);
        if (!data) throw new Error('No data received from API');
        if (cancelled) return;
        setStats(data);
        try { localStorage.setItem('zenith:lastStats', JSON.stringify(data)); } catch {}
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.warn('Stats request timed out; using cached data if present');
        } else {
          console.error('Failed to load dashboard stats:', error);
          const msg = error?.message || 'Unknown error';
          toast.error(`Failed to load dashboard stats: ${msg}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {loading && !stats ? (
          <>
            {isAdmin && <Skeleton className="h-[126px] rounded-lg" />}
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
            <Skeleton className="h-[126px] rounded-lg" />
          </>
        ) : !stats ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Failed to load dashboard statistics. Please refresh the page.
          </div>
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
              value={`${stats.pendingOrders || 0}`}
              description="Awaiting processing"
              icon={<Package className="h-5 w-5" />}
              href="/orders"
            />
            <DashboardStatsCard
              title="Out of Stock Items"
              value={`${stats.outOfStockItems || 0}`}
              description="Needs immediate restocking"
              icon={<PackageX className="h-5 w-5" />}
              href="/inventory"
            />
            <DashboardStatsCard
              title="Shipments In-Transit"
              value={`${stats.shipmentsInTransit || 0}`}
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