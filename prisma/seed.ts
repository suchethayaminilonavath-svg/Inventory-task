import bcrypt from 'bcryptjs';
import prisma from '../backend/src/config/db.js';
import { UserRole, MovementType } from '../backend/src/types/index.js';
import { MovementService } from '../backend/src/services/movementService.js';

async function main() {
  console.log('Seeding StockPilot database...');

  // 1. Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stockpilot.io' },
    update: {},
    create: {
      email: 'admin@stockpilot.io',
      passwordHash,
      name: 'Eleanor Vance (Admin)',
      role: UserRole.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@stockpilot.io' },
    update: {},
    create: {
      email: 'manager@stockpilot.io',
      passwordHash,
      name: 'Marcus Brody (Manager)',
      role: UserRole.WAREHOUSE_MANAGER,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@stockpilot.io' },
    update: {},
    create: {
      email: 'operator@stockpilot.io',
      passwordHash,
      name: 'Samantha Ray (Operator)',
      role: UserRole.INVENTORY_OPERATOR,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@stockpilot.io' },
    update: {},
    create: {
      email: 'auditor@stockpilot.io',
      passwordHash,
      name: 'Arthur Pendelton (Auditor)',
      role: UserRole.AUDITOR,
    },
  });

  console.log('Users seeded (password123):', admin.email, manager.email, operator.email, auditor.email);

  // 2. Categories
  const catElectronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: { name: 'Electronics', description: 'Microcontrollers, sensors, ICs, and accessories' },
  });

  const catHardware = await prisma.category.upsert({
    where: { name: 'Industrial Hardware' },
    update: {},
    create: { name: 'Industrial Hardware', description: 'Fasteners, brackets, chassis, and mounts' },
  });

  const catPackaging = await prisma.category.upsert({
    where: { name: 'Packaging' },
    update: {},
    create: { name: 'Packaging', description: 'Boxes, anti-static bags, bubble mailers' },
  });

  // 3. Warehouses
  const whCentral = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: {},
    create: {
      code: 'WH-CENTRAL',
      name: 'Chicago Central Logistics Hub',
      address: '100 Industrial Pkwy',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postalCode: '60601',
      contactName: 'Frank Miller',
      contactEmail: 'wh-central@stockpilot.io',
      contactPhone: '+1-312-555-0101',
    },
  });

  const whEast = await prisma.warehouse.upsert({
    where: { code: 'WH-EAST' },
    update: {},
    create: {
      code: 'WH-EAST',
      name: 'Newark East Coast Depot',
      address: '450 Dockside Ave',
      city: 'Newark',
      state: 'NJ',
      country: 'USA',
      postalCode: '07101',
      contactName: 'Sarah Jenkins',
      contactEmail: 'wh-east@stockpilot.io',
      contactPhone: '+1-973-555-0202',
    },
  });

  const whWest = await prisma.warehouse.upsert({
    where: { code: 'WH-WEST' },
    update: {},
    create: {
      code: 'WH-WEST',
      name: 'Reno Pacific Gateway',
      address: '88 Sierra Vista Way',
      city: 'Reno',
      state: 'NV',
      country: 'USA',
      postalCode: '89501',
      contactName: 'David Chen',
      contactEmail: 'wh-west@stockpilot.io',
      contactPhone: '+1-775-555-0303',
    },
  });

  // 4. Suppliers
  const supApex = await prisma.supplier.upsert({
    where: { code: 'SUP-APEX' },
    update: {},
    create: {
      code: 'SUP-APEX',
      name: 'Apex Semiconductor Components',
      contactName: 'Laura Bailey',
      email: 'orders@apexcomponents.com',
      phone: '+1-408-555-7788',
      address: '3200 Semiconductor Dr, Santa Clara, CA',
      status: 'ACTIVE',
    },
  });

  const supTitan = await prisma.supplier.upsert({
    where: { code: 'SUP-TITAN' },
    update: {},
    create: {
      code: 'SUP-TITAN',
      name: 'Titan Hardware & Enclosures',
      contactName: 'Robert Vance',
      email: 'sales@titanhardware.com',
      phone: '+1-216-555-3344',
      address: '750 Foundry Rd, Cleveland, OH',
      status: 'ACTIVE',
    },
  });

  // 5. Products
  const prodMCU = await prisma.product.upsert({
    where: { sku: 'ELEC-MCU-32' },
    update: {},
    create: {
      sku: 'ELEC-MCU-32',
      name: 'ARM Cortex-M4 32-bit Microcontroller',
      description: 'High-performance embedded MCU with DSP & FPU',
      categoryId: catElectronics.id,
      uom: 'pcs',
      minStockThreshold: 50,
    },
  });

  const prodSensor = await prisma.product.upsert({
    where: { sku: 'ELEC-SNS-BME' },
    update: {},
    create: {
      sku: 'ELEC-SNS-BME',
      name: 'Precision Barometric & Temp Sensor',
      description: 'I2C/SPI calibrated environmental sensor module',
      categoryId: catElectronics.id,
      uom: 'pcs',
      minStockThreshold: 30,
    },
  });

  const prodChassis = await prisma.product.upsert({
    where: { sku: 'HDW-CHS-10' },
    update: {},
    create: {
      sku: 'HDW-CHS-10',
      name: '1U Aluminum Rackmount Chassis',
      description: 'Anodized aluminum extruded chassis with cooling slots',
      categoryId: catHardware.id,
      uom: 'units',
      minStockThreshold: 15,
    },
  });

  const prodBoxes = await prisma.product.upsert({
    where: { sku: 'PKG-BOX-M' },
    update: {},
    create: {
      sku: 'PKG-BOX-M',
      name: 'Corrugated Shipping Box (Medium)',
      description: 'Double-wall corrugated shipping boxes 12x12x12',
      categoryId: catPackaging.id,
      uom: 'box',
      minStockThreshold: 100,
    },
  });

  // 6. Supplier Products with Cost Prices
  await prisma.supplierProduct.upsert({
    where: { supplierId_productId: { supplierId: supApex.id, productId: prodMCU.id } },
    update: { costPrice: 4.50 },
    create: { supplierId: supApex.id, productId: prodMCU.id, supplierSku: 'APX-M4-32', leadTimeDays: 5, costPrice: 4.50 },
  });

  await prisma.supplierProduct.upsert({
    where: { supplierId_productId: { supplierId: supApex.id, productId: prodSensor.id } },
    update: { costPrice: 2.80 },
    create: { supplierId: supApex.id, productId: prodSensor.id, supplierSku: 'APX-SNS-01', leadTimeDays: 7, costPrice: 2.80 },
  });

  await prisma.supplierProduct.upsert({
    where: { supplierId_productId: { supplierId: supTitan.id, productId: prodChassis.id } },
    update: { costPrice: 32.00 },
    create: { supplierId: supTitan.id, productId: prodChassis.id, supplierSku: 'TTN-1U-AL', leadTimeDays: 14, costPrice: 32.00 },
  });

  // 7. Initial Inventory Movements via MovementService (for auditable ledger)
  const initialStock = [
    { product: prodMCU, warehouse: whCentral, qty: 250, reason: 'Initial warehouse intake' },
    { product: prodSensor, warehouse: whCentral, qty: 150, reason: 'Initial warehouse intake' },
    { product: prodChassis, warehouse: whCentral, qty: 40, reason: 'Initial warehouse intake' },
    { product: prodBoxes, warehouse: whCentral, qty: 400, reason: 'Initial warehouse intake' },

    { product: prodMCU, warehouse: whEast, qty: 80, reason: 'Regional stock allocation' },
    { product: prodSensor, warehouse: whEast, qty: 10, reason: 'Regional stock allocation (Low stock)' },
    { product: prodChassis, warehouse: whEast, qty: 5, reason: 'Regional stock allocation (Low stock)' },

    { product: prodMCU, warehouse: whWest, qty: 120, reason: 'West coast stock allocation' },
  ];

  for (const item of initialStock) {
    const existingInv = await prisma.warehouseInventory.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: item.warehouse.id,
          productId: item.product.id,
        },
      },
    });

    if (!existingInv || existingInv.quantity === 0) {
      await MovementService.recordMovement({
        productId: item.product.id,
        warehouseId: item.warehouse.id,
        movementType: MovementType.STOCK_RECEIVED,
        quantity: item.qty,
        reason: item.reason,
        referenceType: 'MANUAL',
        userId: admin.id,
      });
    }
  }

  console.log('StockPilot database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
