import { IndexedEntity } from "./core-utils";
import type { Product, Order, Shipment, User, Job, JobCard, Location } from "@shared/types";
import { ALL_PERMISSIONS } from "@shared/types";
// Define a type for mock users that includes the password for authentication simulation
type MockUserWithPassword = User & { password: string };
// Mock Data
const MOCK_LOCATIONS: Location[] = [
    { id: 'A01A', name: 'Aisle 1', type: 'Aisle', description: 'Main aisle for heavy items.' },
    { id: 'A01S', name: 'Aisle 1, Shelf 1', type: 'Shelf', description: 'Top shelf for widgets.' },
    { id: 'B02B', name: 'Bin B-07', type: 'Bin', description: 'Small parts bin.' },
    { id: 'D01A', name: 'Receiving Dock A', type: 'Dock', description: 'Primary inbound dock.' },
];
const MOCK_PRODUCTS: Product[] = [
  { id: 'PROD-APL-01', name: 'Organic Apples', category: 'Produce', quantity: 250, locationId: 'A01S', status: 'In Stock', lastUpdated: new Date().toISOString(), expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), storageTemp: '2-4°C', allergens: 'None' },
  { id: 'PROD-CHE-01', name: 'Cheddar Cheese', category: 'Dairy', quantity: 80, locationId: 'A01S', status: 'In Stock', lastUpdated: new Date().toISOString(), expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), storageTemp: '3-5°C', allergens: 'Dairy' },
  { id: 'PROD-PEA-01', name: 'Frozen Peas', category: 'Frozen', quantity: 40, locationId: 'B02B', status: 'Low Stock', lastUpdated: new Date().toISOString(), expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), storageTemp: '-18°C', allergens: 'None' },
  { id: 'PROD-YOG-01', name: 'Greek Yogurt', category: 'Dairy', quantity: 0, locationId: 'B02B', status: 'Out of Stock', lastUpdated: new Date().toISOString(), expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), storageTemp: '3-5°C', allergens: 'Dairy' },
];
const MOCK_ORDERS: Order[] = [
  { id: 'ORD-001', type: 'Sales', customerName: 'Global Corp', date: new Date().toISOString(), status: 'Processing', items: [{ productId: 'PROD-APL-01', productName: 'Organic Apples', quantity: 50 }, { productId: 'PROD-CHE-01', productName: 'Cheddar Cheese', quantity: 20 }], total: 1500.00, itemCount: 70 },
  { id: 'ORD-002', type: 'Sales', customerName: 'Innovate Inc', date: new Date().toISOString(), status: 'Pending', items: [{ productId: 'PROD-PEA-01', productName: 'Frozen Peas', quantity: 10 }], total: 750.50, itemCount: 10 },
  { id: 'ORD-003', type: 'Purchase', customerName: 'Supplier X', date: new Date().toISOString(), status: 'Shipped', items: [{ productId: 'PROD-YOG-01', productName: 'Greek Yogurt', quantity: 100 }], total: 5000.00, itemCount: 100 },
];
const MOCK_SHIPMENTS: Shipment[] = [
    { id: 'SHP-101', trackingNumber: '1Z999AA10123456784', carrier: 'UPS', orderId: 'ORD-001', status: 'In Transit', estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), origin: 'Warehouse A', destination: 'Global Corp HQ' },
    { id: 'SHP-102', trackingNumber: '9400100000000000000000', carrier: 'USPS', orderId: 'ORD-003', status: 'Delivered', estimatedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), origin: 'Supplier X', destination: 'Warehouse A' },
];
export const MOCK_USERS_WITH_PASSWORDS: MockUserWithPassword[] = [
    { id: 'usr-admin', name: 'Admin User', email: 'admin@zenith.com', permissions: [...ALL_PERMISSIONS], password: 'password123' },
    { id: 'usr-manager', name: 'Manager User', email: 'manager@zenith.com', permissions: ['manage:inventory', 'manage:orders', 'manage:shipments', 'view:reports', 'manage:jobs', 'manage:job-cards', 'manage:locations'], password: 'password123' },
    { id: 'usr-operator', name: 'Operator User', email: 'operator@zenith.com', permissions: ['manage:jobs', 'manage:job-cards'], password: 'password123' },
];
const MOCK_JOBS: Job[] = [
    { id: 'JOB-001', customerName: 'Tech Solutions LLC', description: 'Install new server rack', status: 'In Progress', startDate: new Date().toISOString() },
    { id: 'JOB-002', customerName: 'Retail Giant Inc.', description: 'Quarterly inventory audit', status: 'Not Started', startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
];
const MOCK_JOB_CARDS: JobCard[] = [
    { id: 'JC-001', jobId: 'JOB-001', title: 'Assemble Rack', description: 'Assemble the main server rack frame.', status: 'Done' },
    { id: 'JC-002', jobId: 'JOB-001', title: 'Mount Servers', description: 'Mount the 5 new servers into the rack.', status: 'In Progress' },
    { id: 'JC-003', jobId: 'JOB-001', title: 'Cable Management', description: 'Connect all power and network cables.', status: 'To Do' },
];
// ENTITIES
export class ProductEntity extends IndexedEntity<Product> {
  static readonly entityName = "product";
  static readonly indexName = "products";
  static readonly initialState: Product = { id: "", name: "", category: "", quantity: 0, locationId: "", status: 'Out of Stock', lastUpdated: "", expiryDate: "", storageTemp: "", allergens: "" };
  static seedData = MOCK_PRODUCTS;
}
export class OrderEntity extends IndexedEntity<Order> {
  static readonly entityName = "order";
  static readonly indexName = "orders";
  static readonly initialState: Order = { id: "", type: 'Sales', customerName: "", date: "", status: 'Pending', items: [], total: 0, itemCount: 0 };
  static seedData = MOCK_ORDERS;
}
export class ShipmentEntity extends IndexedEntity<Shipment> {
    static readonly entityName = "shipment";
    static readonly indexName = "shipments";
    static readonly initialState: Shipment = { id: "", trackingNumber: "", carrier: "", orderId: "", status: 'Preparing', estimatedDelivery: "", origin: "", destination: "" };
    static seedData = MOCK_SHIPMENTS;
}
export class UserEntity extends IndexedEntity<User> {
    static readonly entityName = "user";
    static readonly indexName = "users";
    static readonly initialState: User = { id: "", name: "", email: "", permissions: [] };
    static seedData = MOCK_USERS_WITH_PASSWORDS.map(({ password, ...user }) => user);
}
export class JobEntity extends IndexedEntity<Job> {
    static readonly entityName = "job";
    static readonly indexName = "jobs";
    static readonly initialState: Job = { id: "", customerName: "", description: "", status: 'Not Started', startDate: "" };
    static seedData = MOCK_JOBS;
}
export class JobCardEntity extends IndexedEntity<JobCard> {
    static readonly entityName = "jobcard";
    static readonly indexName = "jobcards";
    static readonly initialState: JobCard = { id: "", jobId: "", title: "", description: "", status: 'To Do' };
    static seedData = MOCK_JOB_CARDS;
}
export class LocationEntity extends IndexedEntity<Location> {
    static readonly entityName = "location";
    static readonly indexName = "locations";
    static readonly initialState: Location = { id: "", name: "", type: 'Bin', description: "" };
    static seedData = MOCK_LOCATIONS;
}