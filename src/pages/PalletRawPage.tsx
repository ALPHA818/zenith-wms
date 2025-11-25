import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PalletRawPage() {
  return (
    <AppLayout container>
      <PageHeader 
        title="PalletRaw" 
        subtitle="Manage raw material pallets in receiving and storage." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Raw Material Pallets</CardTitle>
          <CardDescription>
            Track and manage incoming raw material pallets and inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            PalletRaw management features coming soon...
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
