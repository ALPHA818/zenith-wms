import { Hono } from "hono";
import type { Env } from './core-utils';
import { ProductEntity, OrderEntity, ShipmentEntity, UserEntity, JobEntity, JobCardEntity, LocationEntity, MessageEntity, GroupEntity, PalletEntity, MOCK_USERS_WITH_PASSWORDS, SettingsEntity, ProductionEventEntity } from "./entities";
import { ok, bad, notFound } from './core-utils';
import { DashboardStats, Order, Product, Shipment, User, productSchema, orderSchema, shipmentSchema, userSchema, InventorySummaryItem, OrderTrendItem, loginSchema, Job, JobCard, jobSchema, jobCardSchema, Location, locationSchema, OrderStatus, Message, messageSchema, Group, groupSchema, Pallet, VehicleInspection, vehicleInspectionSchema, WarehouseSettings, warehouseSettingsSchema } from "@shared/types";
import { z } from 'zod';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // Avoid running seed checks on every request
  let seeded = false;
  // --- AUTH ROUTES ---
  const auth = new Hono<{ Bindings: Env }>();
  auth.post('/login', async (c) => {
    const body = await c.req.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, 'Invalid username or password format.');
    }
    const { name, password } = validation.data;
    const user = MOCK_USERS_WITH_PASSWORDS.find(u => u.name === name);
    if (!user || user.password !== password) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }
    const { password: _, ...userWithoutPassword } = user;
    return ok(c, userWithoutPassword);
  });
  auth.get('/me', async (c) => {
    const user = MOCK_USERS_WITH_PASSWORDS.find(u => u.name === 'Operator User');
    if (!user) {
      return notFound(c, 'User not found');
    }
    const { password: _, ...userWithoutPassword } = user;
    return ok(c, userWithoutPassword);
  });
  app.route('/api/auth', auth);
  // --- WMS ROUTES ---
  const wms = new Hono<{ Bindings: Env }>();
  // Ensure seed data is available (only once per worker instance)
  wms.use('*', async (c, next) => {
    if (!seeded) {
      // Single quick check: if users index has items, assume seeded
      const { items: users } = await UserEntity.list<typeof UserEntity>(c.env, null, 1);
      if (users.length === 0) {
        await Promise.all([
          ProductEntity.ensureSeed(c.env),
          OrderEntity.ensureSeed(c.env),
          ShipmentEntity.ensureSeed(c.env),
          UserEntity.ensureSeed(c.env),
          JobEntity.ensureSeed(c.env),
          JobCardEntity.ensureSeed(c.env),
          LocationEntity.ensureSeed(c.env),
          GroupEntity.ensureSeed(c.env),
          PalletEntity.ensureSeed(c.env),
        ]);
      }
      await SettingsEntity.ensureDefault(c.env);
      seeded = true;
    }
    await next();
  });

  // Settings routes
  const settings = new Hono<{ Bindings: Env }>();
  settings.get('/', async (c) => {
    // Normalize legacy shape to new shape if needed
    const s = await SettingsEntity.get(c.env) as any;
    let normalized: WarehouseSettings;
    if (s && Array.isArray(s.warehouses)) {
      normalized = { warehouses: s.warehouses };
    } else {
      const count = Math.max(1, Math.min(100, Number(s?.warehouseCount ?? 1)));
      const per = Math.max(1, Math.min(10000, Number(s?.palletLocationsPerWarehouse ?? 100)));
      normalized = { warehouses: Array.from({ length: count }, (_, i) => ({ id: `w${i + 1}`, name: `Warehouse ${i + 1}`, palletLocations: per })) };
    }
    return ok<WarehouseSettings>(c, normalized);
  });
  settings.put('/', async (c) => {
    try {
      const body = await c.req.json();
      const parse = warehouseSettingsSchema.safeParse(body);
      if (!parse.success) {
        return bad(c, JSON.stringify(parse.error.flatten().fieldErrors));
      }
      const saved = await SettingsEntity.put(c.env, parse.data);
      return ok<WarehouseSettings>(c, saved);
    } catch (e) {
      return bad(c, 'Invalid payload');
    }
  });
  app.route('/api/settings', settings);
  // Dashboard Stats
  wms.get('/stats', async (c) => {
    try {
      const [products, orders, shipments] = await Promise.all([
        ProductEntity.list<typeof ProductEntity>(c.env).then(p => p.items),
        OrderEntity.list<typeof OrderEntity>(c.env).then(o => o.items),
        ShipmentEntity.list<typeof ShipmentEntity>(c.env).then(s => s.items),
      ]);
      const stats: DashboardStats = {
        totalInventoryValue: 125450.00, // Mocked as product price is not available
        totalInventoryAmount: products.reduce((sum, p) => sum + p.quantity, 0),
        pendingOrders: orders.filter(o => o.status === 'Pending').length,
        outOfStockItems: products.filter(p => p.status === 'Out of Stock').length,
        shipmentsInTransit: shipments.filter(s => s.status === 'In Transit').length,
      };
      return ok(c, stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return bad(c, `Failed to fetch dashboard stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  // --- REPORTING ENDPOINTS ---
  wms.get('/reports/inventory-summary', async (c) => {
    const { items: products } = await ProductEntity.list<typeof ProductEntity>(c.env);
    const data: InventorySummaryItem[] = products
      .filter(product => product.quantity > 0)
      .map(product => ({ 
        name: product.name, 
        quantity: product.quantity 
      }));
    return ok(c, data);
  });
  wms.get('/reports/order-trends', async (c) => {
    const { items: orders } = await OrderEntity.list<typeof OrderEntity>(c.env);
    const trends = orders.reduce((acc, order) => {
      const month = new Date(order.date).toLocaleString('default', { month: 'short', year: '2-digit' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const data: OrderTrendItem[] = Object.entries(trends).map(([month, count]) => ({ month, count }));
    return ok(c, data);
  });
  // --- INVENTORY CRUD ---
  wms.get('/inventory', async (c) => {
    const { items } = await ProductEntity.list<typeof ProductEntity>(c.env);
    return ok(c, items as Product[]);
  });
  
  // --- PALLET CRUD ---
  wms.get('/pallets', async (c) => {
    const { items } = await PalletEntity.list<typeof PalletEntity>(c.env);
    return ok(c, items as Pallet[]);
  });

  wms.post('/pallets', async (c) => {
    const body = await c.req.json();
    // Generate a unique pallet ID
    const { items: existingPallets } = await PalletEntity.list<typeof PalletEntity>(c.env);
    const maxId = existingPallets.reduce((max, p) => {
      const num = parseInt(p.id.split('-').pop() || '0');
      return num > max ? num : max;
    }, 0);
    const newId = `PLT-${String(maxId + 1).padStart(6, '0')}`;
    
    const newPallet: Pallet = {
      id: newId,
      type: body.type,
      locationId: body.locationId,
      expiryDate: body.expiryDate,
      monthsUntilExpiry: body.monthsUntilExpiry,
      products: body.products,
      createdDate: new Date().toISOString(),
      totalQuantity: body.totalQuantity,
    };
    const createdPallet = await PalletEntity.create(c.env, newPallet);
    return ok(c, createdPallet);
  });

  wms.put('/pallets/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const palletEntity = new PalletEntity(c.env, id);
    if (!(await palletEntity.exists())) {
      return notFound(c, 'Pallet not found');
    }
    
    const updatedPalletData: Partial<Pallet> = {
      locationId: body.locationId,
      expiryDate: body.expiryDate,
      monthsUntilExpiry: body.monthsUntilExpiry,
      products: body.products,
      totalQuantity: body.totalQuantity,
    };
    await palletEntity.patch(updatedPalletData);
    const finalPallet = await palletEntity.getState();
    return ok(c, finalPallet);
  });

  wms.delete('/pallets/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await PalletEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Pallet not found');
    return ok(c, { success: true });
  });

  // --- PRODUCTION ROUTE ---
  // Consumes raw materials and produces finished goods by adjusting inventory
  const productionSchema = z.object({
    rawItems: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), batchCode: z.string().optional(), expiryDate: z.string().optional(), supplier: z.string().optional(), rawName: z.string().optional() })).min(1),
    outputItems: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive(), batchCode: z.string().optional(), expiryDate: z.string().optional(), supplier: z.string().optional(), rawName: z.string().optional() })).min(1),
    notes: z.string().optional(),
  });
  wms.post('/production', async (c) => {
    try {
      const body = await c.req.json();
      const parsed = productionSchema.safeParse(body);
      if (!parsed.success) {
        return bad(c, JSON.stringify(parsed.error.flatten().fieldErrors));
      }
      const { rawItems, outputItems } = parsed.data;
      const userId = c.req.header('X-User-Id') || 'unknown';
      const userName = c.req.header('X-User-Name') || 'Unknown User';

      // Validate raw material availability before performing any mutations
      for (const item of rawItems) {
        const productEntity = new ProductEntity(c.env, item.productId);
        if (!(await productEntity.exists())) {
          return notFound(c, `Raw product not found: ${item.productId}`);
        }
        const product = await productEntity.getState();
        if (product.quantity < item.quantity) {
          return bad(c, `Insufficient inventory for ${product.id}. Available: ${product.quantity}, requested: ${item.quantity}`);
        }
      }

      // Subtract raw materials
      for (const item of rawItems) {
        const productEntity = new ProductEntity(c.env, item.productId);
        if (!(await productEntity.exists())) {
          return notFound(c, `Raw product not found: ${item.productId}`);
        }
        await productEntity.mutate((product) => {
          const newQty = Math.max(0, product.quantity - item.quantity);
          const newStatus: Product['status'] = newQty === 0 ? 'Out of Stock' : newQty < 50 ? 'Low Stock' : 'In Stock';
          return { ...product, quantity: newQty, status: newStatus, lastUpdated: new Date().toISOString() };
        });
      }

      // Add finished goods
      for (const item of outputItems) {
        const productEntity = new ProductEntity(c.env, item.productId);
        if (!(await productEntity.exists())) {
          // If finished good doesn't exist, fail fast (could also create, but keeping strict)
          return notFound(c, `Output product not found: ${item.productId}`);
        }
        await productEntity.mutate((product) => {
          const newQty = product.quantity + item.quantity;
          const newStatus: Product['status'] = newQty === 0 ? 'Out of Stock' : newQty < 50 ? 'Low Stock' : 'In Stock';
          return { ...product, quantity: newQty, status: newStatus, lastUpdated: new Date().toISOString() };
        });
      }

      // Return updated inventory snapshot for the involved products
      const updatedIds = [...new Set([...rawItems.map(i => i.productId), ...outputItems.map(i => i.productId)])];
      const updatedProducts: Product[] = [];
      for (const id of updatedIds) {
        const entity = new ProductEntity(c.env, id);
        if (await entity.exists()) {
          updatedProducts.push(await entity.getState());
        }
      }
      // Enrich items with locationId
      const enrichWithLocation = async (items: typeof rawItems) => {
        const out: typeof rawItems = [];
        for (const item of items) {
          const entity = new ProductEntity(c.env, item.productId);
          let locationId: string | undefined = undefined;
          if (await entity.exists()) {
            const prod = await entity.getState();
            locationId = prod.locationId;
          }
          out.push({ ...item, locationId });
        }
        return out;
      };
      const rawItemsWithLoc = await enrichWithLocation(rawItems);
      const outputItemsWithLoc = await enrichWithLocation(outputItems);

      // Record production event
      const { items: existingEvents } = await ProductionEventEntity.list<typeof ProductionEventEntity>(c.env);
      const nextIdNum = existingEvents.length + 1;
      const eventId = `PROD-EVT-${String(nextIdNum).padStart(6, '0')}`;
      const event = await ProductionEventEntity.create(c.env, {
        id: eventId,
        userId,
        userName,
        timestamp: new Date().toISOString(),
        rawItems: rawItemsWithLoc,
        outputItems: outputItemsWithLoc,
        notes: parsed.data.notes,
      });
      return ok(c, { updatedProducts, eventId: event.id });
    } catch (e) {
      return bad(c, 'Invalid payload');
    }
  });

  // Production history listing
  wms.get('/production/history', async (c) => {
    const { items } = await ProductionEventEntity.list<typeof ProductionEventEntity>(c.env);
    // Sort newest first
    items.sort((a, b) => (b.timestamp.localeCompare(a.timestamp)));
    return ok(c, items);
  });

  // Single production event
  wms.get('/production/events/:id', async (c) => {
    const id = c.req.param('id');
    const entity = new ProductionEventEntity(c.env, id);
    if (!(await entity.exists())) {
      return notFound(c, 'Production event not found');
    }
    const evt = await entity.getState();
    return ok(c, evt);
  });
  
  wms.post('/inventory', async (c) => {
    const body = await c.req.json();
    const validation = productSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, quantity } = validation.data;
    const existing = new ProductEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["SKU already exists."] }));
    }
    const status: Product['status'] = quantity === 0 ? 'Out of Stock' : quantity < 50 ? 'Low Stock' : 'In Stock';
    const newProduct: Product = { ...validation.data, status, lastUpdated: new Date().toISOString() };
    const createdProduct = await ProductEntity.create(c.env, newProduct);
    return ok(c, createdProduct);
  });
  wms.put('/inventory/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = productSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const productEntity = new ProductEntity(c.env, id);
    if (!(await productEntity.exists())) {
      return notFound(c, 'Product not found');
    }
    const { quantity } = validation.data;
    const status: Product['status'] = quantity === 0 ? 'Out of Stock' : quantity < 50 ? 'Low Stock' : 'In Stock';
    const updatedProductData: Partial<Product> = { ...validation.data, status, lastUpdated: new Date().toISOString() };
    await productEntity.patch(updatedProductData);
    const finalProduct = await productEntity.getState();
    return ok(c, finalProduct);
  });
  wms.delete('/inventory/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await ProductEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Product not found');
    return ok(c, { success: true });
  });
  // --- ORDERS CRUD ---
  wms.get('/orders', async (c) => {
    const { items } = await OrderEntity.list<typeof OrderEntity>(c.env);
    return ok(c, items as Order[]);
  });
  wms.post('/orders', async (c) => {
    const body = await c.req.json();
    const validation = orderSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, type, customerName, carrier, items } = validation.data;
    const existing = new OrderEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Order ID already exists."] }));
    }
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = itemCount * 50.25; // Mock total calculation
    const newOrder: Order = { id, type, customerName, carrier, items, status: 'Pending', date: new Date().toISOString(), itemCount, total };
    const createdOrder = await OrderEntity.create(c.env, newOrder);
    
    // Automatically create a Job and JobCard for this order
    const { items: existingJobs } = await JobEntity.list<typeof JobEntity>(c.env);
    const maxJobId = existingJobs.reduce((max, j) => {
      const num = parseInt(j.id.replace('JOB-', ''));
      return num > max ? num : max;
    }, 0);
    const jobId = `JOB-${String(maxJobId + 1).padStart(4, '0')}`;
    
    const newJob: Job = {
      id: jobId,
      customerName: customerName,
      description: `${type} Order ${id} - ${itemCount} items`,
      status: 'Not Started',
      startDate: new Date().toISOString(),
    };
    await JobEntity.create(c.env, newJob);
    
    // Create job card for the order
    const { items: existingCards } = await JobCardEntity.list<typeof JobCardEntity>(c.env);
    const maxCardId = existingCards.reduce((max, c) => {
      const num = parseInt(c.id.replace('CARD-', ''));
      return num > max ? num : max;
    }, 0);
    const cardId = `CARD-${String(maxCardId + 1).padStart(4, '0')}`;
    
    const newCard: JobCard = {
      id: cardId,
      jobId: jobId,
      orderId: id,
      title: `Order ${id} - ${customerName}`,
      description: `Process ${type.toLowerCase()} order with ${itemCount} items`,
      status: 'To Do',
    };
    await JobCardEntity.create(c.env, newCard);
    
    // Automatically create a Shipment for this order to be inspected by QC
    const { items: existingShipments } = await ShipmentEntity.list<typeof ShipmentEntity>(c.env);
    const maxShipmentId = existingShipments.reduce((max, s) => {
      const num = parseInt(s.id.replace('SHP-', ''));
      return num > max ? num : max;
    }, 0);
    const shipmentId = `SHP-${String(maxShipmentId + 1).padStart(4, '0')}`;
    
    // Generate tracking number
    const trackingNumber = `TRK${Date.now().toString().slice(-8)}`;
    
    const newShipment: Shipment = {
      id: shipmentId,
      trackingNumber: trackingNumber,
      carrier: carrier,
      orderId: id,
      status: 'Preparing',
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      origin: 'Warehouse',
      destination: customerName,
    };
    await ShipmentEntity.create(c.env, newShipment);
    
    return ok(c, createdOrder);
  });
  wms.put('/orders/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = orderSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const orderEntity = new OrderEntity(c.env, id);
    if (!(await orderEntity.exists())) {
      return notFound(c, 'Order not found');
    }
    const { type, customerName, carrier, items } = validation.data;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = itemCount * 50.25; // Mock total calculation
    const updatedOrderData: Partial<Order> = { type, customerName, carrier, items, itemCount, total };
    await orderEntity.patch(updatedOrderData);
    const finalOrder = await orderEntity.getState();
    return ok(c, finalOrder);
  });
  wms.delete('/orders/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await OrderEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Order not found');
    return ok(c, { success: true });
  });
  wms.patch('/orders/:id/status', async (c) => {
    const id = c.req.param('id');
    const { status } = await c.req.json<{ status: OrderStatus }>();
    if (!status) {
      return bad(c, 'Status is required');
    }
    const orderEntity = new OrderEntity(c.env, id);
    if (!(await orderEntity.exists())) {
      return notFound(c, 'Order not found');
    }
    const order = await orderEntity.getState();
    // Inventory adjustment logic
    if (order.type === 'Sales' && status === 'Shipped' && order.status !== 'Shipped') {
      await Promise.all(order.items.map(async (item) => {
        const productEntity = new ProductEntity(c.env, item.productId);
        if (await productEntity.exists()) {
          await productEntity.mutate(product => {
            const newQuantity = product.quantity - item.quantity;
            const newStatus: Product['status'] = newQuantity <= 0 ? 'Out of Stock' : newQuantity < 50 ? 'Low Stock' : 'In Stock';
            return { ...product, quantity: newQuantity, status: newStatus, lastUpdated: new Date().toISOString() };
          });
        }
      }));
    } else if (order.type === 'Purchase' && status === 'Delivered' && order.status !== 'Delivered') {
      await Promise.all(order.items.map(async (item) => {
        const productEntity = new ProductEntity(c.env, item.productId);
        if (await productEntity.exists()) {
          await productEntity.mutate(product => {
            const newQuantity = product.quantity + item.quantity;
            const newStatus: Product['status'] = newQuantity <= 0 ? 'Out of Stock' : newQuantity < 50 ? 'Low Stock' : 'In Stock';
            return { ...product, quantity: newQuantity, status: newStatus, lastUpdated: new Date().toISOString() };
          });
        }
      }));
    }
    await orderEntity.patch({ status });
    const updatedOrder = await orderEntity.getState();
    return ok(c, updatedOrder);
  });
  // --- SHIPMENTS CRUD ---
  wms.get('/shipments', async (c) => {
    const { items } = await ShipmentEntity.list<typeof ShipmentEntity>(c.env);
    return ok(c, items as Shipment[]);
  });
  wms.post('/shipments', async (c) => {
    const body = await c.req.json();
    const validation = shipmentSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new ShipmentEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Shipment ID already exists."] }));
    }
    const newShipment: Shipment = { id, ...rest, estimatedDelivery: new Date(rest.estimatedDelivery).toISOString() };
    const createdShipment = await ShipmentEntity.create(c.env, newShipment);
    return ok(c, createdShipment);
  });
  wms.put('/shipments/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = shipmentSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const shipmentEntity = new ShipmentEntity(c.env, id);
    if (!(await shipmentEntity.exists())) {
      return notFound(c, 'Shipment not found');
    }
    const { ...rest } = validation.data;
    const updatedShipmentData: Partial<Shipment> = { ...rest, estimatedDelivery: new Date(rest.estimatedDelivery).toISOString() };
    await shipmentEntity.patch(updatedShipmentData);
    const finalShipment = await shipmentEntity.getState();
    return ok(c, finalShipment);
  });
  wms.delete('/shipments/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await ShipmentEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Shipment not found');
    return ok(c, { success: true });
  });

  // --- VEHICLE INSPECTION ENDPOINTS ---
  wms.post('/shipments/:id/dispatch-inspection', async (c) => {
    const shipmentId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate inspection data
    const validation = vehicleInspectionSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }

    // Get the shipment
    const shipmentEntity = new ShipmentEntity(c.env, shipmentId);
    if (!(await shipmentEntity.exists())) {
      return notFound(c, 'Shipment not found');
    }

    // Get current user from request headers (assuming auth middleware sets this)
    const userId = c.req.header('X-User-Id') || 'unknown';
    const userName = c.req.header('X-User-Name') || 'Unknown User';

    // Create inspection record
    const inspection: VehicleInspection = {
      ...validation.data,
      inspectionDate: new Date().toISOString(),
      inspectedBy: userId,
      inspectorName: userName,
    };

    // Reduce inventory for dispatched products
    for (const item of inspection.items) {
      const productEntity = new ProductEntity(c.env, item.productId);
      if (await productEntity.exists()) {
        const product = await productEntity.getState();
        const newQuantity = Math.max(0, product.quantity - item.quantity);
        const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 50 ? 'Low Stock' : 'In Stock';
        
        await productEntity.patch({
          quantity: newQuantity,
          status: newStatus,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    // Update shipment with inspection data
    await shipmentEntity.patch({ dispatchInspection: inspection });
    const updatedShipment = await shipmentEntity.getState();

    // Create or update order as "In Transit"
    const orderId = updatedShipment.orderId;
    const orderEntity = new OrderEntity(c.env, orderId);
    
    if (await orderEntity.exists()) {
      // Update existing order to Shipped status
      await orderEntity.patch({ 
        status: 'Shipped' as OrderStatus,
        date: new Date().toISOString()
      });
    } else {
      // Create new order from inspection data
      const newOrder: Order = {
        id: orderId,
        type: 'Sales' as OrderType,
        customerName: inspection.driverName || 'Unknown',
        date: new Date().toISOString(),
        status: 'Shipped' as OrderStatus,
        items: inspection.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: 0, // Price would need to be fetched from product
          subtotal: 0
        })),
        total: 0,
        itemCount: inspection.items.reduce((sum, item) => sum + item.quantity, 0)
      };
      await OrderEntity.create(c.env, newOrder);
    }

    return ok(c, updatedShipment);
  });

  wms.post('/shipments/:id/receiving-inspection', async (c) => {
    const shipmentId = c.req.param('id');
    const body = await c.req.json();
    
    // Validate inspection data
    const validation = vehicleInspectionSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }

    // Get the shipment
    const shipmentEntity = new ShipmentEntity(c.env, shipmentId);
    if (!(await shipmentEntity.exists())) {
      return notFound(c, 'Shipment not found');
    }

    // Get current user from request headers
    const userId = c.req.header('X-User-Id') || 'unknown';
    const userName = c.req.header('X-User-Name') || 'Unknown User';

    // Create inspection record
    const inspection: VehicleInspection = {
      ...validation.data,
      inspectionDate: new Date().toISOString(),
      inspectedBy: userId,
      inspectorName: userName,
    };

    // Add inventory for received products
    for (const item of inspection.items) {
      const productEntity = new ProductEntity(c.env, item.productId);
      if (await productEntity.exists()) {
        const product = await productEntity.getState();
        const newQuantity = product.quantity + item.quantity;
        const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 50 ? 'Low Stock' : 'In Stock';
        
        await productEntity.patch({
          quantity: newQuantity,
          status: newStatus,
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    // Update shipment with inspection data
    await shipmentEntity.patch({ receivingInspection: inspection });
    const updatedShipment = await shipmentEntity.getState();

    // Create or update order as "In Transit"
    const orderId = updatedShipment.orderId;
    const orderEntity = new OrderEntity(c.env, orderId);
    
    if (await orderEntity.exists()) {
      // Update existing order to Shipped status (In Transit)
      await orderEntity.patch({ 
        status: 'Shipped' as OrderStatus,
        date: new Date().toISOString()
      });
    } else {
      // Create new order from inspection data
      const newOrder: Order = {
        id: orderId,
        type: 'Purchase' as OrderType,
        customerName: inspection.driverName || 'Unknown Supplier',
        date: new Date().toISOString(),
        status: 'Shipped' as OrderStatus,
        items: inspection.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: 0, // Price would need to be fetched from product
          subtotal: 0
        })),
        total: 0,
        itemCount: inspection.items.reduce((sum, item) => sum + item.quantity, 0)
      };
      await OrderEntity.create(c.env, newOrder);
    }

    return ok(c, updatedShipment);
  });

  // --- USERS CRUD ---
  wms.get('/users', async (c) => {
    const { items } = await UserEntity.list<typeof UserEntity>(c.env);
    return ok(c, items as User[]);
  });
  wms.post('/users', async (c) => {
    const body = await c.req.json();
    const validation = userSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new UserEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["User ID already exists."] }));
    }
    const newUser: User = { id, ...rest };
    const createdUser = await UserEntity.create(c.env, newUser);
    return ok(c, createdUser);
  });
  wms.put('/users/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = userSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const userEntity = new UserEntity(c.env, id);
    if (!(await userEntity.exists())) {
      return notFound(c, 'User not found');
    }
    const currentUser = await userEntity.getState();
    // Safeguard: Prevent removing the last user with 'manage:users' permission
    const isLosingUserManagement = (currentUser.permissions || []).includes('manage:users') && !validation.data.permissions.includes('manage:users');
    if (isLosingUserManagement) {
        const { items: allUsers } = await UserEntity.list<typeof UserEntity>(c.env);
        const usersWithPermission = allUsers.filter(u => (u.permissions || []).includes('manage:users')).length;
        if (usersWithPermission <= 1) {
            return bad(c, "Cannot remove the 'manage:users' permission from the last user who has it.");
        }
    }
    const updatedUserData: Partial<User> = validation.data;
    await userEntity.patch(updatedUserData);
    const finalUser = await userEntity.getState();
    return ok(c, finalUser);
  });
  wms.delete('/users/:id', async (c) => {
    const id = c.req.param('id');
    const userEntity = new UserEntity(c.env, id);
    if (!(await userEntity.exists())) {
      return notFound(c, 'User not found');
    }
    const userToDelete = await userEntity.getState();
    // Safeguard: Prevent deleting the last user with 'manage:users' permission
    if ((userToDelete.permissions || []).includes('manage:users')) {
        const { items: allUsers } = await UserEntity.list<typeof UserEntity>(c.env);
        const usersWithPermission = allUsers.filter(u => (u.permissions || []).includes('manage:users')).length;
        if (usersWithPermission <= 1) {
            return bad(c, "Cannot delete the last user with 'manage:users' permission.");
        }
    }
    const existed = await UserEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'User not found');
    return ok(c, { success: true });
  });
  // --- JOBS CRUD ---
  wms.get('/jobs', async (c) => {
    const { items } = await JobEntity.list<typeof JobEntity>(c.env);
    return ok(c, items as Job[]);
  });
  wms.post('/jobs', async (c) => {
    const body = await c.req.json();
    const validation = jobSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new JobEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Job ID already exists."] }));
    }
    const newJob: Job = { id, ...rest, startDate: new Date(rest.startDate).toISOString() };
    const createdJob = await JobEntity.create(c.env, newJob);
    return ok(c, createdJob);
  });
  wms.put('/jobs/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = jobSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const jobEntity = new JobEntity(c.env, id);
    if (!(await jobEntity.exists())) {
      return notFound(c, 'Job not found');
    }
    const { ...rest } = validation.data;
    const updatedJobData: Partial<Job> = { ...rest, startDate: new Date(rest.startDate).toISOString() };
    await jobEntity.patch(updatedJobData);
    const finalJob = await jobEntity.getState();
    return ok(c, finalJob);
  });
  wms.delete('/jobs/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await JobEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Job not found');
    return ok(c, { success: true });
  });
  // --- JOB CARDS CRUD ---
  wms.get('/job-cards', async (c) => {
    const jobId = c.req.query('jobId');
    const { items } = await JobCardEntity.list<typeof JobCardEntity>(c.env);
    const filteredItems = jobId ? items.filter(card => card.jobId === jobId) : items;
    return ok(c, filteredItems as JobCard[]);
  });
  wms.post('/job-cards', async (c) => {
    const body = await c.req.json();
    const validation = jobCardSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new JobCardEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Job Card ID already exists."] }));
    }
    const newCard: JobCard = { id, ...rest };
    const createdCard = await JobCardEntity.create(c.env, newCard);
    return ok(c, createdCard);
  });
  wms.put('/job-cards/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    // Use partial validation for status updates from DnD
    const validation = jobCardSchema.partial().safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const cardEntity = new JobCardEntity(c.env, id);
    if (!(await cardEntity.exists())) {
      return notFound(c, 'Job Card not found');
    }
    await cardEntity.patch(validation.data);
    const finalCard = await cardEntity.getState();
    return ok(c, finalCard);
  });
  wms.delete('/job-cards/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await JobCardEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Job Card not found');
    return ok(c, { success: true });
  });

  // Upload document to job card (employee action)
  wms.post('/job-cards/:id/upload-document', async (c) => {
    const id = c.req.param('id');
    const { documentUrl, userId, userName } = await c.req.json<{ documentUrl: string; userId: string; userName: string }>();
    
    if (!documentUrl) {
      return bad(c, 'Document URL is required');
    }
    
    const cardEntity = new JobCardEntity(c.env, id);
    if (!(await cardEntity.exists())) {
      return notFound(c, 'Job Card not found');
    }
    
    await cardEntity.patch({
      documentUrl,
      documentUploadedAt: new Date().toISOString(),
      documentUploadedBy: userId,
      status: 'Awaiting QC' as JobCardStatus,
    });
    
    const updatedCard = await cardEntity.getState();
    return ok(c, updatedCard);
  });

  // QC approval (QC personnel action)
  wms.post('/job-cards/:id/qc-approve', async (c) => {
    const id = c.req.param('id');
    const { approved, notes, userId } = await c.req.json<{ approved: boolean; notes?: string; userId: string }>();
    
    const cardEntity = new JobCardEntity(c.env, id);
    if (!(await cardEntity.exists())) {
      return notFound(c, 'Job Card not found');
    }
    
    const card = await cardEntity.getState();
    if (!card.documentUrl) {
      return bad(c, 'No document has been uploaded for this job card');
    }
    
    // If rejecting, require notes
    if (!approved && !notes?.trim()) {
      return bad(c, 'Rejection reason is required');
    }
    
    if (approved) {
      await cardEntity.patch({
        qcApproved: true,
        qcApprovedAt: new Date().toISOString(),
        qcApprovedBy: userId,
        qcNotes: notes,
        status: 'Done' as JobCardStatus,
      });
    } else {
      // If not approved, send back to In Progress
      await cardEntity.patch({
        qcApproved: false,
        qcNotes: notes,
        status: 'In Progress' as JobCardStatus,
      });
      
      // Notify admin users about the rejection
      const { items: allUsers } = await UserEntity.list<typeof UserEntity>(c.env);
      const adminUsers = allUsers.filter(u => u.permissions.includes('manage:users'));
      
      // Get the QC user who rejected it
      const qcUser = allUsers.find(u => u.id === userId);
      const qcUserName = qcUser?.name || 'QC Personnel';
      
      // Create notification messages for each admin
      const timestamp = new Date().toISOString();
      for (const admin of adminUsers) {
        const messageId = `msg-rejection-${id}-${admin.id}-${Date.now()}`;
        const notificationMessage: Message = {
          id: messageId,
          senderId: userId,
          senderName: qcUserName,
          recipientId: admin.id,
          content: `Job Card "${card.title}" (${id}) has been rejected. Reason: ${notes}`,
          timestamp,
          read: false,
        };
        await MessageEntity.create(c.env, notificationMessage);
      }
    }
    
    const updatedCard = await cardEntity.getState();
    return ok(c, updatedCard);
  });

  // --- LOCATIONS CRUD ---
  wms.get('/locations', async (c) => {
    const { items } = await LocationEntity.list<typeof LocationEntity>(c.env);
    return ok(c, items as Location[]);
  });
  wms.post('/locations', async (c) => {
    const body = await c.req.json();
    const validation = locationSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new LocationEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Location ID already exists."] }));
    }
    const newLocation: Location = { id, ...rest };
    const createdLocation = await LocationEntity.create(c.env, newLocation);
    return ok(c, createdLocation);
  });
  wms.put('/locations/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = locationSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const locationEntity = new LocationEntity(c.env, id);
    if (!(await locationEntity.exists())) {
      return notFound(c, 'Location not found');
    }
    await locationEntity.patch(validation.data);
    const finalLocation = await locationEntity.getState();
    return ok(c, finalLocation);
  });
  wms.delete('/locations/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await LocationEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Location not found');
    return ok(c, { success: true });
  });

  // --- GROUPS CRUD ---
  wms.get('/groups', async (c) => {
    const { items } = await GroupEntity.list<typeof GroupEntity>(c.env);
    return ok(c, items as Group[]);
  });

  wms.post('/groups', async (c) => {
    const body = await c.req.json();
    const validation = groupSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const { id, ...rest } = validation.data;
    const existing = new GroupEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Group ID already exists."] }));
    }
    
    // Get current user from headers if available
    const userId = c.req.header('X-User-Id') || 'system';
    
    const newGroup: Group = {
      id,
      ...rest,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    const createdGroup = await GroupEntity.create(c.env, newGroup);
    return ok(c, createdGroup);
  });

  wms.put('/groups/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validation = groupSchema.omit({ id: true }).safeParse(body);
    if (!validation.success) {
      return bad(c, JSON.stringify(validation.error.flatten().fieldErrors));
    }
    const groupEntity = new GroupEntity(c.env, id);
    if (!(await groupEntity.exists())) {
      return notFound(c, 'Group not found');
    }
    await groupEntity.patch(validation.data);
    const finalGroup = await groupEntity.getState();
    return ok(c, finalGroup);
  });

  wms.delete('/groups/:id', async (c) => {
    const id = c.req.param('id');
    const existed = await GroupEntity.delete(c.env, id);
    if (!existed) return notFound(c, 'Group not found');
    return ok(c, { success: true });
  });

  // --- MESSAGE ROUTES ---
  wms.get('/messages', async (c) => {
    const { items } = await MessageEntity.list<typeof MessageEntity>(c.env);
    return ok(c, items);
  });

  wms.post('/messages', async (c) => {
    const body = await c.req.json();
    const validation = messageSchema.safeParse(body);
    if (!validation.success) {
      return bad(c, validation.error.errors[0]?.message || 'Invalid message data');
    }
    const message: Message = {
      ...validation.data,
      id: validation.data.id || `msg-${Date.now()}`,
      timestamp: validation.data.timestamp || new Date().toISOString(),
    };
    const createdMessage = await MessageEntity.create(c.env, message);
    return ok(c, createdMessage);
  });

  wms.put('/messages/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ content: string }>();
    if (!body.content || body.content.trim() === '') {
      return bad(c, 'Message content is required');
    }
    const messageEntity = new MessageEntity(c.env, id);
    if (!(await messageEntity.exists())) {
      return notFound(c, 'Message not found');
    }
    const currentMessage = await messageEntity.getState();
    const editHistory = currentMessage.editHistory || [];
    editHistory.push({
      content: currentMessage.content,
      editedAt: new Date().toISOString(),
    });
    await messageEntity.patch({
      content: body.content,
      isEdited: true,
      editedAt: new Date().toISOString(),
      editHistory,
    });
    const updatedMessage = await messageEntity.getState();
    return ok(c, updatedMessage);
  });

  wms.delete('/messages/:id', async (c) => {
    const id = c.req.param('id');
    const { userId } = await c.req.json<{ userId: string }>();
    const messageEntity = new MessageEntity(c.env, id);
    if (!(await messageEntity.exists())) {
      return notFound(c, 'Message not found');
    }
    await messageEntity.patch({
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: userId,
    });
    const deletedMessage = await messageEntity.getState();
    return ok(c, deletedMessage);
  });

  app.route('/api/wms', wms);
}