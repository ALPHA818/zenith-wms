import { Hono } from "hono";
import type { Env } from './core-utils';
import { ProductEntity, OrderEntity, ShipmentEntity, UserEntity, JobEntity, JobCardEntity, LocationEntity, MOCK_USERS_WITH_PASSWORDS } from "./entities";
import { ok, bad, notFound } from './core-utils';
import { DashboardStats, Order, Product, Shipment, User, productSchema, orderSchema, shipmentSchema, userSchema, InventorySummaryItem, OrderTrendItem, loginSchema, Job, JobCard, jobSchema, jobCardSchema, Location, locationSchema, OrderStatus } from "@shared/types";
export function userRoutes(app: Hono<{ Bindings: Env }>) {
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
  // Ensure seed data is available
  wms.use('*', async (c, next) => {
    await Promise.all([
      ProductEntity.ensureSeed(c.env),
      OrderEntity.ensureSeed(c.env),
      ShipmentEntity.ensureSeed(c.env),
      UserEntity.ensureSeed(c.env),
      JobEntity.ensureSeed(c.env),
      JobCardEntity.ensureSeed(c.env),
      LocationEntity.ensureSeed(c.env),
    ]);
    await next();
  });
  // Dashboard Stats
  wms.get('/stats', async (c) => {
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
  });
  // --- REPORTING ENDPOINTS ---
  wms.get('/reports/inventory-summary', async (c) => {
    const { items: products } = await ProductEntity.list<typeof ProductEntity>(c.env);
    const summary = products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + product.quantity;
      return acc;
    }, {} as Record<string, number>);
    const data: InventorySummaryItem[] = Object.entries(summary).map(([name, quantity]) => ({ name, quantity }));
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
    const { id, type, customerName, items } = validation.data;
    const existing = new OrderEntity(c.env, id);
    if (await existing.exists()) {
      return bad(c, JSON.stringify({ id: ["Order ID already exists."] }));
    }
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = itemCount * 50.25; // Mock total calculation
    const newOrder: Order = { id, type, customerName, items, status: 'Pending', date: new Date().toISOString(), itemCount, total };
    const createdOrder = await OrderEntity.create(c.env, newOrder);
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
    const { type, customerName, items } = validation.data;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = itemCount * 50.25; // Mock total calculation
    const updatedOrderData: Partial<Order> = { type, customerName, items, itemCount, total };
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
  app.route('/api/wms', wms);
}