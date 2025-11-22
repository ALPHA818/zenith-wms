import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { DashboardStatsCard } from "@/components/wms/DashboardStatsCard";
import { DollarSign, Package, PackageX, Truck, Boxes } from "lucide-react";
import { DashboardStats } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.permissions?.includes('manage:users') ?? false;
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
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
              />
            )}
            <DashboardStatsCard
              title="Total Inventory Amount"
              value={(stats.totalInventoryAmount || 0).toLocaleString()}
              description="Total units in stock"
              icon={<Boxes className="h-5 w-5" />}
            />
            <DashboardStatsCard
              title="Pending Orders"
              value={`+${stats.pendingOrders}`}
              description="Awaiting processing"
              icon={<Package className="h-5 w-5" />}
            />
            <DashboardStatsCard
              title="Out of Stock Items"
              value={`${stats.outOfStockItems}`}
              description="Needs immediate restocking"
              icon={<PackageX className="h-5 w-5" />}
            />
            <DashboardStatsCard
              title="Shipments In-Transit"
              value={`+${stats.shipmentsInTransit}`}
              description="Currently on the way"
              icon={<Truck className="h-5 w-5" />}
            />
          </>
        )}
      </div>
      <Toaster richColors />
    </AppLayout>
  );
}