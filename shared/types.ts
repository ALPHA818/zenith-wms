import { z } from 'zod';
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// Zenith WMS Core Types
export const ALL_PERMISSIONS = [
  'manage:inventory',
  'manage:orders',
  'manage:shipments',
  'view:reports',
  'manage:users',
  'manage:jobs',
  'manage:job-cards',
  'manage:locations',
  'manage:location-ids',
  'manage:qc',
  'manage:financing',
] as const;
export type Permission = typeof ALL_PERMISSIONS[number];
export interface User {
  id: string;
  name: string;
  email: string;
  permissions: Permission[];
  password?: string; // Only populated for admins viewing user list
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string; // 'all' for company-wide messages
  content: string;
  timestamp: string;
  read: boolean;
  isEdited?: boolean;
  editedAt?: string;
  editHistory?: Array<{ content: string; editedAt: string }>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  memberIds: string[]; // User IDs
  createdAt: string;
  createdBy: string; // User ID
}

export type PalletStatus = 'Ready' | 'In Transit' | 'Delivered';
export type PalletType = 'Product' | 'Raw';

export interface PalletProduct {
  id: string; // SKU
  name: string;
  category: string;
  quantity: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  expiryDate?: string; // ISO 8601 date string
  batchCode?: string;
  allergens?: string;
}

export interface Pallet {
  id: string;
  type: PalletType;
  locationId: string;
  expiryDate?: string; // ISO 8601 date string - overall pallet expiry
  monthsUntilExpiry?: number; // Calculated months until expiry
  products: PalletProduct[];
  createdDate: string; // ISO 8601 date string
  totalQuantity: number;
}

export interface Product {
  id: string; // SKU
  name: string;
  category: string;
  quantity: number;
  locationId: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  lastUpdated: string; // ISO 8601 date string
  expiryDate?: string; // ISO 8601 date string
  storageTemp?: string;
  allergens?: string;
}
export type OrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
export type OrderType = 'Sales' | 'Purchase';
export interface OrderLineItem {
  productId: string;
  productName: string;
  quantity: number;
}
export interface Order {
  id: string;
  type: OrderType;
  customerName: string; // Or supplier name for purchase orders
  carrier: string; // Carrier/shipping company
  date: string; // ISO 8601 date string
  status: OrderStatus;
  items: OrderLineItem[];
  total: number; // Calculated on backend
  itemCount: number; // Calculated on backend
}
export type ShipmentStatus = 'Preparing' | 'In Transit' | 'Delivered' | 'Delayed';

export interface VehicleInspectionItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface VehicleInspection {
  // Vehicle interior condition checklist
  hasHoles: boolean;
  isWet: boolean;
  isClean: boolean;
  hasDamage: boolean;
  hasOdor: boolean;
  temperatureOk: boolean;
  
  // Driver and vehicle information
  driverName: string;
  vehicleRegistration: string;
  orderDocumentationNumber: string;
  deliveryTime?: string; // For dispatch - when delivery is expected
  arrivalTime?: string; // For receiving - when vehicle arrived
  
  // Products being dispatched/received
  items: VehicleInspectionItem[];
  
  // Inspection metadata
  inspectionDate: string; // ISO 8601 date string
  inspectedBy: string; // User ID
  inspectorName: string;
  notes?: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  carrier: string;
  orderId: string;
  status: ShipmentStatus;
  estimatedDelivery: string; // ISO 8601 date string
  origin: string;
  destination: string;
  
  // Inspection data
  dispatchInspection?: VehicleInspection;
  receivingInspection?: VehicleInspection;
}
export interface DashboardStats {
  totalInventoryValue: number;
  totalInventoryAmount: number;
  pendingOrders: number;
  outOfStockItems: number;
  shipmentsInTransit: number;
}
// Warehouse Settings
export interface WarehouseConfig {
  id: string; // stable id like "w1", "w2"
  name?: string; // optional display name
  palletLocations: number;
}
export interface WarehouseSettings {
  warehouses: WarehouseConfig[];
}

export const warehouseConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  palletLocations: z.number().int().min(1, "At least 1 location").max(10000, "Too many locations"),
});

export const warehouseSettingsSchema = z.object({
  warehouses: z.array(warehouseConfigSchema).min(1, "At least 1 warehouse").max(100, "Too many warehouses"),
});
// Reporting Types
export interface InventorySummaryItem {
  name: string;
  quantity: number;
}
export interface OrderTrendItem {
  month: string;
  count: number;
}
// Job & JobCard Types
export type JobCardStatus = 'To Do' | 'In Progress' | 'Awaiting QC' | 'Done';
export interface JobCard {
  id: string;
  jobId: string;
  orderId?: string; // Link to order if created from order
  title: string;
  description?: string;
  status: JobCardStatus;
  documentUrl?: string; // Employee uploaded document
  documentUploadedAt?: string; // When document was uploaded
  documentUploadedBy?: string; // User ID who uploaded
  qcApproved?: boolean; // QC approval status
  qcApprovedAt?: string; // When QC approved
  qcApprovedBy?: string; // User ID who approved
  qcNotes?: string; // QC notes/comments
}
export type JobStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
export interface Job {
  id: string;
  customerName: string;
  description: string;
  status: JobStatus;
  startDate: string; // ISO 8601 date string
}
// Location Types
export type LocationType = 'Aisle' | 'Shelf' | 'Bin' | 'Zone' | 'Dock';
export interface Location {
  id: string;
  name: string;
  type: LocationType;
  description?: string;
}
// Zod Schema for Login
export const loginSchema = z.object({
  name: z.string().min(3, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
// Zod Schema for Product Validation
export const productSchema = z.object({
  id: z.string().min(1, "SKU is required"),
  name: z.string().min(3, "Product name must be at least 3 characters"),
  category: z.string().min(1, "Category is required"),
  quantity: z.number().int().nonnegative("Quantity must be a non-negative number"),
  locationId: z.string().min(1, "Location is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  storageTemp: z.string().optional(),
  allergens: z.string().optional(),
});
export type ProductFormData = z.infer<typeof productSchema>;
// Zod Schema for Order Line Item
export const orderLineItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productName: z.string(), // Not validated on client, populated from selected product
  quantity: z.number().int().positive("Quantity must be a positive number"),
});
// Zod Schema for Order Validation
export const orderSchema = z.object({
  id: z.string().min(1, "Order ID is required"),
  type: z.enum(['Sales', 'Purchase']),
  customerName: z.string().min(3, "Customer/Supplier name must be at least 3 characters"),
  carrier: z.string().min(1, "Carrier is required"),
  items: z.array(orderLineItemSchema).min(1, "Order must have at least one item."),
});
export type OrderFormData = z.infer<typeof orderSchema>;
// Zod Schema for Shipment Validation
export const shipmentSchema = z.object({
    id: z.string().min(1, "Shipment ID is required"),
    trackingNumber: z.string().min(5, "Tracking number must be at least 5 characters"),
    carrier: z.string().min(1, "Carrier is required"),
    orderId: z.string().min(1, "Order ID is required"),
    status: z.enum(['Preparing', 'In Transit', 'Delivered', 'Delayed']),
    estimatedDelivery: z.string().min(1, "Estimated delivery date is required"),
    origin: z.string().min(1, "Origin is required"),
    destination: z.string().min(1, "Destination is required"),
    dispatchInspection: z.object({
      hasHoles: z.boolean(),
      isWet: z.boolean(),
      isClean: z.boolean(),
      hasDamage: z.boolean(),
      hasOdor: z.boolean(),
      temperatureOk: z.boolean(),
      driverName: z.string().min(1, "Driver name is required"),
      vehicleRegistration: z.string().min(1, "Vehicle registration is required"),
      orderDocumentationNumber: z.string().min(1, "Order documentation number is required"),
      deliveryTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().positive(),
      })),
      inspectionDate: z.string(),
      inspectedBy: z.string(),
      inspectorName: z.string(),
      notes: z.string().optional(),
    }).optional(),
    receivingInspection: z.object({
      hasHoles: z.boolean(),
      isWet: z.boolean(),
      isClean: z.boolean(),
      hasDamage: z.boolean(),
      hasOdor: z.boolean(),
      temperatureOk: z.boolean(),
      driverName: z.string().min(1, "Driver name is required"),
      vehicleRegistration: z.string().min(1, "Vehicle registration is required"),
      orderDocumentationNumber: z.string().min(1, "Order documentation number is required"),
      deliveryTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().positive(),
      })),
      inspectionDate: z.string(),
      inspectedBy: z.string(),
      inspectorName: z.string(),
      notes: z.string().optional(),
    }).optional(),
});
export type ShipmentFormData = z.infer<typeof shipmentSchema>;

// Zod Schema for Vehicle Inspection
export const vehicleInspectionSchema = z.object({
  hasHoles: z.boolean(),
  isWet: z.boolean(),
  isClean: z.boolean(),
  hasDamage: z.boolean(),
  hasOdor: z.boolean(),
  temperatureOk: z.boolean(),
  driverName: z.string().min(2, "Driver name must be at least 2 characters"),
  vehicleRegistration: z.string().min(2, "Vehicle registration is required"),
  orderDocumentationNumber: z.string().min(1, "Order documentation number is required"),
  deliveryTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, "Product is required"),
    productName: z.string(),
    quantity: z.number().int().positive("Quantity must be positive"),
  })).min(1, "At least one product must be added"),
  notes: z.string().optional(),
});
export type VehicleInspectionFormData = z.infer<typeof vehicleInspectionSchema>;
// Zod Schema for User Validation
export const userSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional().default([]),
});
export type UserFormData = z.infer<typeof userSchema>;
// Zod Schema for User Form - allows optional permissions to match User type
export const userFormSchema = userSchema.extend({
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
});
export type UserFormSchemaData = z.infer<typeof userFormSchema>;
// Zod Schema for Job Validation
export const jobSchema = z.object({
  id: z.string().min(1, "Job ID is required"),
  customerName: z.string().min(3, "Customer name must be at least 3 characters"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(['Not Started', 'In Progress', 'Completed', 'On Hold']),
  startDate: z.string().min(1, "Start date is required"),
});
export type JobFormData = z.infer<typeof jobSchema>;
// Zod Schema for Job Card Validation
export const jobCardSchema = z.object({
  id: z.string().min(1, "Card ID is required"),
  jobId: z.string().min(1, "Associated Job ID is required"),
  orderId: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  status: z.enum(['To Do', 'In Progress', 'Awaiting QC', 'Done']),
  documentUrl: z.string().optional(),
  documentUploadedAt: z.string().optional(),
  documentUploadedBy: z.string().optional(),
  qcApproved: z.boolean().optional(),
  qcApprovedAt: z.string().optional(),
  qcApprovedBy: z.string().optional(),
  qcNotes: z.string().optional(),
});
export type JobCardFormData = z.infer<typeof jobCardSchema>;
// Zod Schema for Location Validation
export const locationSchema = z.object({
  id: z.string().regex(/^[A-Z]\d{2}[A-Z]$/, "ID must be in the format 'A12B' (Letter, 2 Digits, Letter)."),
  name: z.string().min(1, "Location name is required"),
  type: z.enum(['Aisle', 'Shelf', 'Bin', 'Zone', 'Dock']),
  description: z.string().optional(),
});
export type LocationFormData = z.infer<typeof locationSchema>;

// Zod Schema for Message Validation
export const messageSchema = z.object({
  id: z.string(),
  senderId: z.string().min(1, "Sender ID is required"),
  senderName: z.string().min(1, "Sender name is required"),
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: z.string().min(1, "Message content is required"),
  timestamp: z.string(),
  read: z.boolean().default(false),
  isEdited: z.boolean().optional(),
  editedAt: z.string().optional(),
  editHistory: z.array(z.object({ content: z.string(), editedAt: z.string() })).optional(),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().optional(),
  deletedBy: z.string().optional(),
});
export type MessageFormData = z.infer<typeof messageSchema>;

// Production Types
export const productionLineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  batchCode: z.string().optional(),
  expiryDate: z.string().optional(),
  supplier: z.string().optional(),
  rawName: z.string().optional(),
  locationId: z.string().optional(),
});
export const productionEventSchema = z.object({
  id: z.string(),
  userId: z.string().min(1),
  userName: z.string().min(1),
  timestamp: z.string(),
  rawItems: z.array(productionLineItemSchema),
  outputItems: z.array(productionLineItemSchema),
  notes: z.string().optional(),
});
export type ProductionLineItem = z.infer<typeof productionLineItemSchema>;
export type ProductionEvent = z.infer<typeof productionEventSchema>;

// Zod Schema for Group Validation
export const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
});
export type GroupFormData = z.infer<typeof groupSchema>;