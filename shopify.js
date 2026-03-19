const fetch = require('node-fetch');

const SHOP  = 'lrdm-petits.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;
const API   = `https://${SHOP}/admin/api/2024-01`;

async function shopifyGetAll(endpoint, key) {
  let results = [], url = `${API}${endpoint}`;
  while (url) {
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': TOKEN }
    });
    if (!r.ok) throw new Error(`Shopify ${r.status}: ${r.statusText}`);
    const data = await r.json();
    results = results.concat(data[key] || []);
    const link = r.headers.get('Link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { type, days = 30 } = req.query;

  try {
    if (type === 'orders') {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days));
      const orders = await shopifyGetAll(
        `/orders.json?status=any&created_at_min=${since.toISOString()}&limit=250&fields=id,created_at,total_price,currency,customer,line_items`,
        'orders'
      );
      return res.json(orders);
    }
    if (type === 'active') {
      const products = await shopifyGetAll(
        `/products.json?status=active&limit=250&fields=id,title,product_type,status,variants`,
        'products'
      );
      return res.json(products);
    }
    if (type === 'archive') {
      const products = await shopifyGetAll(
        `/products.json?status=draft&limit=250&fields=id,title,product_type,status,variants`,
        'products'
      );
      return res.json(products);
    }
    res.status(400).json({ error: 'Unknown type' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
