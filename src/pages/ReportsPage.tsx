import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { InventorySummaryItem, OrderTrendItem } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Generate 100 distinct colors
const generateColors = (count: number) => {
  const colors = [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))', 
    'hsl(var(--chart-5))',
  ];
  
  // Generate additional colors using HSL with varying hue
  for (let i = 0; i < count - 5; i++) {
    const hue = (i * 360 / (count - 5)) % 360;
    const saturation = 60 + (i % 3) * 10;
    const lightness = 50 + (i % 4) * 5;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
};

const COLORS = generateColors(100);

export function ReportsPage() {
  const [inventoryData, setInventoryData] = useState<InventorySummaryItem[]>([]);
  const [orderData, setOrderData] = useState<OrderTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [invSummary, orderTrends] = await Promise.all([
          api<InventorySummaryItem[]>('/api/wms/reports/inventory-summary'),
          api<OrderTrendItem[]>('/api/wms/reports/order-trends'),
        ]);
        setInventoryData(invSummary);
        setOrderData(orderTrends);
      } catch (error) {
        toast.error("Failed to load reporting data.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get unique categories
  const categories = Array.from(new Set(inventoryData.map(item => {
    // Extract category from product name (e.g., "Product 1 - Produce" -> "Produce")
    const match = item.name.match(/- (.+)$/);
    return match ? match[1] : "Unknown";
  })));

  // Filter data by search and category
  const filteredData = inventoryData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const itemCategory = item.name.match(/- (.+)$/)?.[1] || "Unknown";
    const matchesCategory = selectedCategory === "all" || itemCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Split filtered data into chunks of 100 for multiple pie charts
  const pieChartChunks = [];
  for (let i = 0; i < filteredData.length; i += 100) {
    pieChartChunks.push(filteredData.slice(i, i + 100));
  }

  const currentChunk = pieChartChunks[currentPage] || [];

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(pieChartChunks.length - 1, prev + 1));
  };

  const renderPieChart = (data: InventorySummaryItem[]) => {
    const shouldShowLabels = data.length <= 10;
    
    return (
      <ResponsiveContainer width="100%" height={500}>
        <PieChart>
          <Pie 
            data={data} 
            dataKey="quantity" 
            nameKey="name" 
            cx="50%"
            cy="50%" 
            outerRadius={150} 
            fill="hsl(var(--primary))" 
            label={shouldShowLabels ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
            startAngle={rotation}
            endAngle={rotation + 360}
          >
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <AppLayout container>
      <PageHeader title="Reports & Analytics" subtitle="Visualize your warehouse performance." />
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Inventory by Product
                {pieChartChunks.length > 1 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (Page {currentPage + 1}/{pieChartChunks.length})
                  </span>
                )}
              </CardTitle>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <List className="h-4 w-4 mr-2" />
                    Legend
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Product Legend</SheetTitle>
                    <SheetDescription>
                      {currentChunk.length} products on this page
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(0);
                      }}
                    />
                    <Select value={selectedCategory} onValueChange={(value) => {
                      setSelectedCategory(value);
                      setCurrentPage(0);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-2">
                        {currentChunk.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <div
                              className="w-4 h-4 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            <span className="flex-1">{item.name}</span>
                            <span className="text-muted-foreground">{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[500px]" />
            ) : currentChunk.length > 0 ? (
              <>
                {renderPieChart(currentChunk)}
                {pieChartChunks.length > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {pieChartChunks.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === pieChartChunks.length - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                No products found
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly Order Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orderData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Orders" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      <Toaster richColors />
    </AppLayout>
  );
}