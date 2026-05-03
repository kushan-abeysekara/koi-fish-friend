const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:8081';
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 20000);
const SEED_TAG = process.env.SEED_TAG || 'DEMO_SEED_2026_05';

const client = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

function nowDate() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choose(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function toFixedNumber(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMode() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  if (!modeArg) return 'reset-seed';
  return modeArg.split('=')[1] || 'reset-seed';
}

async function apiGet(path, params) {
  const response = await client.get(path, { params });
  return response.data;
}

async function apiPost(path, body) {
  const response = await client.post(path, body);
  return response.data;
}

async function apiDelete(path) {
  const response = await client.delete(path);
  return response.data;
}

function dataArray(apiResponse) {
  if (!apiResponse || !Array.isArray(apiResponse.data)) return [];
  return apiResponse.data;
}

function withTag(text) {
  return `${SEED_TAG} | ${text}`;
}

async function ensureDemoPonds() {
  const existing = dataArray(await apiGet('/ponds'));
  const existingNames = new Set(existing.map((p) => String(p.name || '').toLowerCase()));

  const demoPonds = [
    { name: 'Demo Pond A', color: 'blue' },
    { name: 'Demo Pond B', color: 'green' },
    { name: 'Demo Pond C', color: 'orange' },
    { name: 'Demo Pond D', color: 'purple' },
  ];

  for (const pond of demoPonds) {
    if (!existingNames.has(pond.name.toLowerCase())) {
      await apiPost('/ponds', pond);
    }
  }

  return dataArray(await apiGet('/ponds')).filter((p) => String(p.name || '').toLowerCase().startsWith('demo pond'));
}

async function ensureDemoInventoryItems() {
  const existing = dataArray(await apiGet('/inventory'));
  const byName = new Set(existing.map((i) => String(i.name || '').toLowerCase()));

  const templates = [
    { name: 'Demo - Floating Feed 3mm', category: 'Feed', unit: 'kg', reorderLevel: 30, costPerUnit: 620 },
    { name: 'Demo - Floating Feed 5mm', category: 'Feed', unit: 'kg', reorderLevel: 35, costPerUnit: 700 },
    { name: 'Demo - Probiotic Mix', category: 'Medicine', unit: 'kg', reorderLevel: 10, costPerUnit: 1800 },
    { name: 'Demo - Salt (Treatment)', category: 'Medicine', unit: 'kg', reorderLevel: 20, costPerUnit: 260 },
    { name: 'Demo - Aerator Stone', category: 'Equipment', unit: 'pcs', reorderLevel: 12, costPerUnit: 950 },
    { name: 'Demo - Water Test Kit', category: 'Equipment', unit: 'pcs', reorderLevel: 8, costPerUnit: 3200 },
    { name: 'Demo - Net (Medium)', category: 'Tools', unit: 'pcs', reorderLevel: 6, costPerUnit: 1400 },
    { name: 'Demo - PVC Pipe 1 inch', category: 'Maintenance', unit: 'm', reorderLevel: 40, costPerUnit: 180 },
  ];

  for (const item of templates) {
    if (!byName.has(item.name.toLowerCase())) {
      await apiPost('/inventory', {
        name: item.name,
        category: item.category,
        currentStock: 0,
        unit: item.unit,
        reorderLevel: item.reorderLevel,
        costPerUnit: item.costPerUnit,
        lastRestocked: nowDate(),
        supplier: SEED_TAG,
      });
    }
  }

  return dataArray(await apiGet('/inventory')).filter((i) => {
    const name = String(i.name || '').toLowerCase();
    const supplier = String(i.supplier || '');
    return name.startsWith('demo -') || supplier.includes(SEED_TAG);
  });
}

async function seedFishCounts(ponds) {
  let created = 0;

  for (const pond of ponds) {
    const base = randInt(350, 650);

    for (let day = 90; day >= 0; day -= 3) {
      const fluctuation = randInt(-25, 20);
      const count = Math.max(50, base + fluctuation - Math.floor((90 - day) * 0.4));
      const payload = {
        date: daysAgoDate(day),
        pondId: pond.id,
        count,
        notes: withTag('Simulated fish count for analytics testing'),
        countMethod: 'vision',
        countedBy: 'demo-seeder',
      };

      await apiPost('/fish-counts', payload);
      created += 1;
    }
  }

  return created;
}

async function seedStockTransactions(items, ponds) {
  let created = 0;

  for (const item of items) {
    const baseCost = Number(item.costPerUnit || 100);

    for (let i = 0; i < 2; i += 1) {
      const qty = item.unit === 'kg' ? randInt(40, 120) : randInt(6, 25);
      const unitCost = toFixedNumber(baseCost * (1 + randInt(-8, 12) / 100), 2);
      const pond = choose(ponds);

      await apiPost('/stock-transactions', {
        itemId: item.id,
        type: 'add',
        quantity: qty,
        date: daysAgoDate(randInt(20, 90)),
        pondId: pond.id,
        notes: withTag(`Restock batch ${i + 1}`),
        unitCost,
      });
      created += 1;
    }

    for (let i = 0; i < 3; i += 1) {
      const qty = item.unit === 'kg' ? randInt(4, 20) : randInt(1, 5);
      const pond = choose(ponds);

      await apiPost('/stock-transactions', {
        itemId: item.id,
        type: 'use',
        quantity: qty,
        date: daysAgoDate(randInt(0, 60)),
        pondId: pond.id,
        notes: withTag(`Usage batch ${i + 1}`),
      });
      created += 1;
    }
  }

  return created;
}

async function seedManualExpenditures(ponds) {
  const categories = [
    { category: 'Labor', subcategory: 'Daily Operations' },
    { category: 'Utilities', subcategory: 'Electricity' },
    { category: 'Maintenance', subcategory: 'Equipment Repair' },
    { category: 'Medicine', subcategory: 'Water Treatment' },
    { category: 'Fish Stocking', subcategory: 'Fingerlings' },
    { category: 'Transport', subcategory: 'Local Delivery' },
  ];

  let created = 0;

  for (let i = 0; i < 48; i += 1) {
    const pond = choose(ponds);
    const cat = choose(categories);
    const amount = toFixedNumber(randInt(2500, 85000) + Math.random(), 2);

    await apiPost('/expenditures', {
      date: daysAgoDate(randInt(0, 120)),
      category: cat.category,
      subcategory: cat.subcategory,
      description: withTag(`Synthetic expense #${i + 1}`),
      amount,
      pondId: pond.id,
    });

    created += 1;
  }

  return created;
}

async function seedRevenues(ponds) {
  const revenueSources = ['Consulting', 'Tours', 'Other'];
  const species = ['Kohaku', 'Sanke', 'Showa', 'Asagi', 'Shusui'];
  const paymentMethods = ['Cash', 'Bank Transfer', 'Digital'];
  const paymentStatuses = ['Paid', 'Paid', 'Paid', 'Partial', 'Pending'];

  let created = 0;

  for (let i = 0; i < 56; i += 1) {
    const pond = choose(ponds);
    const source = choose(revenueSources);
    const quantitySold = randInt(10, 120);
    const pricePerUnit = randInt(900, 2800);
    const amount = toFixedNumber(quantitySold * pricePerUnit, 2);

    await apiPost('/revenues', {
      date: daysAgoDate(randInt(0, 120)),
      pondId: pond.id,
      source,
      amount,
      quantitySold,
      pricePerUnit,
      fishSpecies: choose(species),
      customerName: `Demo Buyer ${randInt(1, 24)}`,
      notes: withTag(`Synthetic revenue #${i + 1}`),
      paymentMethod: choose(paymentMethods),
      paymentStatus: choose(paymentStatuses),
    });

    created += 1;
  }

  return created;
}

async function resetTaggedData() {
  let fishDeleted = 0;
  let expDeleted = 0;
  let revDeleted = 0;
  let txDeleted = 0;
  let itemDeleted = 0;

  const fishCounts = dataArray(await apiGet('/fish-counts'));
  for (const row of fishCounts) {
    if (String(row.notes || '').includes(SEED_TAG)) {
      await apiDelete(`/fish-counts/${row.id}`);
      fishDeleted += 1;
    }
  }

  const expenditures = dataArray(await apiGet('/expenditures'));
  for (const row of expenditures) {
    const text = `${row.description || ''} ${row.subcategory || ''}`;
    if (text.includes(SEED_TAG)) {
      await apiDelete(`/expenditures/${row.id}`);
      expDeleted += 1;
    }
  }

  const revenues = dataArray(await apiGet('/revenues'));
  for (const row of revenues) {
    const text = `${row.notes || ''} ${row.customerName || ''}`;
    if (text.includes(SEED_TAG)) {
      await apiDelete(`/revenues/${row.id}`);
      revDeleted += 1;
    }
  }

  const txs = dataArray(await apiGet('/stock-transactions'));
  for (const row of txs) {
    if (String(row.notes || '').includes(SEED_TAG)) {
      await apiDelete(`/stock-transactions/${row.id}`);
      txDeleted += 1;
    }
  }

  await sleep(400);

  const items = dataArray(await apiGet('/inventory'));
  for (const item of items) {
    const isDemoName = String(item.name || '').toLowerCase().startsWith('demo -');
    const isDemoSupplier = String(item.supplier || '').includes(SEED_TAG);
    if (isDemoName || isDemoSupplier) {
      try {
        await apiDelete(`/inventory/${item.id}`);
        itemDeleted += 1;
      } catch (error) {
        const reason = error?.response?.data?.message || error.message;
        console.warn(`Skip deleting inventory item ${item.id}: ${reason}`);
      }
    }
  }

  return { fishDeleted, expDeleted, revDeleted, txDeleted, itemDeleted };
}

async function printSummary() {
  const [ponds, fishCounts, expenditures, revenues, inventoryItems, txs] = await Promise.all([
    apiGet('/ponds'),
    apiGet('/fish-counts'),
    apiGet('/expenditures'),
    apiGet('/revenues'),
    apiGet('/inventory'),
    apiGet('/stock-transactions'),
  ]);

  const summary = {
    ponds: dataArray(ponds).length,
    fishCounts: dataArray(fishCounts).length,
    expenditures: dataArray(expenditures).length,
    revenues: dataArray(revenues).length,
    inventoryItems: dataArray(inventoryItems).length,
    stockTransactions: dataArray(txs).length,
  };

  console.log('Current totals:', summary);
}

async function run() {
  const mode = parseMode();
  if (!['append', 'reset', 'reset-seed'].includes(mode)) {
    throw new Error(`Invalid mode '${mode}'. Use append, reset, or reset-seed.`);
  }

  console.log(`Demo seeder started | mode=${mode} | api=${API_URL} | tag=${SEED_TAG}`);

  if (mode === 'reset' || mode === 'reset-seed') {
    const reset = await resetTaggedData();
    console.log('Reset completed:', reset);
  }

  if (mode === 'append' || mode === 'reset-seed') {
    const ponds = await ensureDemoPonds();
    if (ponds.length === 0) {
      throw new Error('No ponds available after setup. Seeding cannot continue.');
    }

    const items = await ensureDemoInventoryItems();
    if (items.length === 0) {
      throw new Error('No inventory items available after setup. Seeding cannot continue.');
    }

    const fishCountCreated = await seedFishCounts(ponds);
    const stockTxCreated = await seedStockTransactions(items, ponds);
    const manualExpCreated = await seedManualExpenditures(ponds);
    const revenueCreated = await seedRevenues(ponds);

    console.log('Seed completed:', {
      pondsUsed: ponds.length,
      inventoryItemsUsed: items.length,
      fishCountCreated,
      stockTxCreated,
      manualExpCreated,
      revenueCreated,
      note: 'Stock add transactions also auto-create expenditures in backend.',
    });
  }

  await printSummary();
}

run()
  .then(() => {
    console.log('Demo seeder finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    const details = error?.response?.data || error?.message || error;
    console.error('Demo seeder failed:', details);
    process.exit(1);
  });
