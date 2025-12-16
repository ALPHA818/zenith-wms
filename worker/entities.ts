import { Entity, IndexedEntity } from "./core-utils";
import type { Product, Order, Shipment, User, Job, JobCard, Location, Message, Group, Pallet, PalletProduct, WarehouseSettings } from "@shared/types";
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

// Generate mock pallets with products and raw materials
const generateAllPallets = (): Pallet[] => {
  const categories = ['Produce', 'Dairy', 'Frozen', 'Bakery', 'Beverages', 'Snacks', 'Canned Goods', 'Meat', 'Seafood', 'Pantry'];
  const rawMaterials = ['Flour', 'Sugar', 'Salt', 'Yeast', 'Cocoa Powder', 'Corn Starch', 'Baking Powder', 'Milk Powder', 'Gelatin', 'Rice'];
  const locations = ['A01S', 'B02B', 'D01A'];
  const pallets: Pallet[] = [];
  
  let globalPalletCounter = 1;
  
  // Create 25 finished products across pallets
  const totalProducts = 25;
  let productCounter = 1;
  
  while (productCounter <= totalProducts) {
    // Each pallet has 1-2 products
    const productsInPallet = Math.min(
      Math.floor(Math.random() * 2) + 1,
      totalProducts - productCounter + 1,
      5 // max 5 products per pallet
    );
    const palletProducts: PalletProduct[] = [];
    
    for (let j = 0; j < productsInPallet; j++) {
      const category = categories[productCounter % categories.length];
      const quantity = Math.floor(Math.random() * 500) + 1;
      const status: PalletProduct['status'] = quantity === 0 ? 'Out of Stock' : quantity < 50 ? 'Low Stock' : 'In Stock';
      
      // Generate batch code
      const year = new Date().getFullYear();
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const batchNum = String(productCounter).padStart(3, '0');
      const batchCode = `BATCH-${year}-${month}${day}-${batchNum}`;
      
      palletProducts.push({
        id: `PROD-${String(productCounter).padStart(5, '0')}`,
        name: `Product ${productCounter} - ${category}`,
        category,
        quantity,
        status,
        expiryDate: new Date(Date.now() + (30 + productCounter % 335) * 24 * 60 * 60 * 1000).toISOString(),
        batchCode,
        allergens: productCounter % 3 === 0 ? 'None' : productCounter % 3 === 1 ? 'Dairy' : 'Nuts',
      });
      
      productCounter++;
    }
    
    const totalQuantity = palletProducts.reduce((sum, p) => sum + p.quantity, 0);
    
    // Generate random expiry date (1-24 months from now)
    const monthsUntilExpiry = Math.floor(Math.random() * 24) + 1;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + monthsUntilExpiry);
    
    pallets.push({
      id: `PLT-${String(globalPalletCounter).padStart(6, '0')}`,
      type: 'Product',
      locationId: locations[globalPalletCounter % locations.length],
      expiryDate: expiryDate.toISOString(),
      monthsUntilExpiry,
      products: palletProducts,
      createdDate: new Date().toISOString(),
      totalQuantity,
    });
    
    globalPalletCounter++;
  }
  
  // Create 20 raw materials across pallets
  const totalMaterials = 20;
  let materialCounter = 1;
  
  while (materialCounter <= totalMaterials) {
    // Each pallet has 1-2 raw materials
    const materialsInPallet = Math.min(
      Math.floor(Math.random() * 2) + 1,
      totalMaterials - materialCounter + 1,
      5 // max 5 materials per pallet
    );
    const palletMaterials: PalletProduct[] = [];
    
    for (let j = 0; j < materialsInPallet; j++) {
      const material = rawMaterials[materialCounter % rawMaterials.length];
      const quantity = Math.floor(Math.random() * 1000) + 100;
      const status: PalletProduct['status'] = quantity === 0 ? 'Out of Stock' : quantity < 200 ? 'Low Stock' : 'In Stock';
      
      // Generate lot number
      const year = new Date().getFullYear();
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const lotNum = String(materialCounter).padStart(3, '0');
      const batchCode = `LOT-${year}-${month}${day}-${lotNum}`;
      
      palletMaterials.push({
        id: `RAW-${String(materialCounter).padStart(5, '0')}`,
        name: `${material} ${materialCounter}`,
        category: 'Raw Material',
        quantity,
        status,
        batchCode,
        allergens: 'N/A',
      });
      
      materialCounter++;
    }
    
    const totalQuantity = palletMaterials.reduce((sum, p) => sum + p.quantity, 0);
    
    // Generate random expiry date (6-36 months from now for raw materials)
    const monthsUntilExpiry = Math.floor(Math.random() * 31) + 6;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + monthsUntilExpiry);
    
    pallets.push({
      id: `PLT-${String(globalPalletCounter).padStart(6, '0')}`,
      type: 'Raw',
      locationId: locations[globalPalletCounter % locations.length],
      expiryDate: expiryDate.toISOString(),
      monthsUntilExpiry,
      products: palletMaterials,
      createdDate: new Date().toISOString(),
      totalQuantity,
    });
    
    globalPalletCounter++;
  }
  
  return pallets;
};

const MOCK_PALLETS: Pallet[] = generateAllPallets();

// Generate products from pallets (for backward compatibility with inventory page)
const generateMockProducts = (): Product[] => {
  const products: Product[] = [];
  
  MOCK_PALLETS.forEach(pallet => {
    pallet.products.forEach(palletProduct => {
      products.push({
        id: palletProduct.id,
        name: palletProduct.name,
        category: palletProduct.category,
        quantity: palletProduct.quantity,
        locationId: pallet.locationId,
        status: palletProduct.status,
        lastUpdated: new Date().toISOString(),
        expiryDate: palletProduct.expiryDate,
        storageTemp: palletProduct.batchCode,
        allergens: palletProduct.allergens,
      });
    });
  });
  
  return products;
};

const MOCK_PRODUCTS: Product[] = generateMockProducts();

const MOCK_ORDERS: Order[] = [
  { id: 'ORD-001', type: 'Sales', customerName: 'Global Corp', carrier: 'UPS', date: new Date().toISOString(), status: 'Processing', items: [{ productId: 'PROD-APL-01', productName: 'Organic Apples', quantity: 50 }, { productId: 'PROD-CHE-01', productName: 'Cheddar Cheese', quantity: 20 }], total: 1500.00, itemCount: 70 },
  { id: 'ORD-002', type: 'Sales', customerName: 'Innovate Inc', carrier: 'FedEx', date: new Date().toISOString(), status: 'Pending', items: [{ productId: 'PROD-PEA-01', productName: 'Frozen Peas', quantity: 10 }], total: 750.50, itemCount: 10 },
  { id: 'ORD-003', type: 'Purchase', customerName: 'Supplier X', carrier: 'USPS', date: new Date().toISOString(), status: 'Shipped', items: [{ productId: 'PROD-YOG-01', productName: 'Greek Yogurt', quantity: 100 }], total: 5000.00, itemCount: 100 },
];
const MOCK_SHIPMENTS: Shipment[] = [
    { 
      id: 'SHP-101', 
      trackingNumber: '1Z999AA10123456784', 
      carrier: 'UPS', 
      orderId: 'ORD-001', 
      status: 'In Transit', 
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), 
      origin: 'Warehouse A', 
      destination: 'Global Corp HQ',
      dispatchInspection: undefined,
      receivingInspection: undefined,
    },
    { 
      id: 'SHP-102', 
      trackingNumber: '9400100000000000000000', 
      carrier: 'USPS', 
      orderId: 'ORD-003', 
      status: 'Delivered', 
      estimatedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), 
      origin: 'Supplier X', 
      destination: 'Warehouse A',
      dispatchInspection: undefined,
      receivingInspection: undefined,
    },
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
  static readonly initialState: Order = { id: "", type: 'Sales', customerName: "", carrier: "", date: "", status: 'Pending', items: [], total: 0, itemCount: 0 };
  static seedData = MOCK_ORDERS;
}
export class ShipmentEntity extends IndexedEntity<Shipment> {
    static readonly entityName = "shipment";
    static readonly indexName = "shipments";
    static readonly initialState: Shipment = { 
      id: "", 
      trackingNumber: "", 
      carrier: "", 
      orderId: "", 
      status: 'Preparing', 
      estimatedDelivery: "", 
      origin: "", 
      destination: "",
      dispatchInspection: undefined,
      receivingInspection: undefined,
    };
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
    static readonly initialState: JobCard = { 
      id: "", 
      jobId: "", 
      orderId: undefined,
      title: "", 
      description: "", 
      status: 'To Do',
      documentUrl: undefined,
      documentUploadedAt: undefined,
      documentUploadedBy: undefined,
      qcApproved: undefined,
      qcApprovedAt: undefined,
      qcApprovedBy: undefined,
      qcNotes: undefined,
    };
    static seedData = MOCK_JOB_CARDS;
}
export class LocationEntity extends IndexedEntity<Location> {
    static readonly entityName = "location";
    static readonly indexName = "locations";
    static readonly initialState: Location = { id: "", name: "", type: 'Bin', description: "" };
    static seedData = MOCK_LOCATIONS;
}

export class MessageEntity extends IndexedEntity<Message> {
    static readonly entityName = "message";
    static readonly indexName = "messages";
    static readonly initialState: Message = { id: "", senderId: "", senderName: "", recipientId: "all", content: "", timestamp: "", read: false, isEdited: false, isDeleted: false };
    static seedData: Message[] = [];
}

export class GroupEntity extends IndexedEntity<Group> {
    static readonly entityName = "group";
    static readonly indexName = "groups";
    static readonly initialState: Group = { id: "", name: "", description: "", memberIds: [], createdAt: "", createdBy: "" };
    static seedData: Group[] = [];
}

export class PalletEntity extends IndexedEntity<Pallet> {
    static readonly entityName = "pallet";
    static readonly indexName = "pallets";
    static readonly initialState: Pallet = { 
      id: "", 
      type: 'Product', 
      locationId: "", 
      expiryDate: undefined,
      monthsUntilExpiry: 0,
      products: [], 
      createdDate: "", 
      totalQuantity: 0 
    };
    static seedData = MOCK_PALLETS;
}

// Single-document app settings entity
export class SettingsEntity extends Entity<WarehouseSettings> {
  static readonly entityName = "settings";
  static readonly initialState: WarehouseSettings = { warehouses: [{ id: 'w1', name: 'Warehouse 1', palletLocations: 100 }] };

  static async get(env: any): Promise<WarehouseSettings> {
    const inst = new SettingsEntity(env as any, 'global');
    return inst.getState();
  }

  static async put(env: any, next: WarehouseSettings): Promise<WarehouseSettings> {
    const inst = new SettingsEntity(env as any, 'global');
    await inst.save(next);
    return next;
  }

  static async ensureDefault(env: any): Promise<void> {
    const inst = new SettingsEntity(env as any, 'global');
    if (!(await inst.exists())) {
      await inst.save(SettingsEntity.initialState);
    }
  }
}