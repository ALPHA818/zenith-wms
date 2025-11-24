import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, List, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
  const [rotationSpeed, setRotationSpeed] = useState(50); // Default 50ms interval
  const [isRotating, setIsRotating] = useState(true); // Control rotation on/off

  useEffect(() => {
    if (!isRotating) return;
    
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, rotationSpeed);
    return () => clearInterval(interval);
  }, [rotationSpeed, isRotating]);

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
      <ResponsiveContainer width="100%" height={1200}>
        <PieChart>
          <Pie 
            data={data} 
            dataKey="quantity" 
            nameKey="name" 
            cx="50%"
            cy="50%" 
            outerRadius={400} 
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
      <div className="grid gap-8 grid-cols-1">
        <Card className="col-span-full">
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
              <div className="flex gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Chart Settings</SheetTitle>
                      <SheetDescription>
                        Customize the pie chart rotation speed
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Rotation</Label>
                          <Button
                            variant={isRotating ? "default" : "outline"}
                            size="sm"
                            onClick={() => setIsRotating(!isRotating)}
                          >
                            {isRotating ? "Stop" : "Start"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label htmlFor="rotation-speed">
                          Rotation Speed
                          <span className="text-sm text-muted-foreground ml-2">
                            ({rotationSpeed}ms)
                          </span>
                        </Label>
                        <Slider
                          id="rotation-speed"
                          min={10}
                          max={500}
                          step={10}
                          value={[rotationSpeed]}
                          onValueChange={(value) => setRotationSpeed(value[0])}
                          className="w-full"
                          disabled={!isRotating}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Fast (10ms)</span>
                          <span>Slow (500ms)</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          {isRotating ? "Lower values = faster rotation" : "Rotation is stopped"}
                          {isRotating && <><br />Higher values = slower rotation</>}
                        </p>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
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
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[1200px]" />
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
              <div className="flex items-center justify-center h-[1200px] text-muted-foreground">
                No products found
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Monthly Order Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[600px]" />
            ) : (
              <ResponsiveContainer width="100%" height={600}>
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