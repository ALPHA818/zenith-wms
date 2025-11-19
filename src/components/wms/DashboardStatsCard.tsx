import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
interface DashboardStatsCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}
export function DashboardStatsCard({ title, value, description, icon, className }: DashboardStatsCardProps) {
  return (
    <Card className={cn("transition-all duration-300 hover:shadow-lg hover:-translate-y-1", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}