const SHOP = process.env.SHOPIFY_SHOP || 'lrdm-petits.myshopify.com';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const API = `https://${SHOP}/admin/api/2024-01`;

async function getAccessToken() {
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(data.error_description || data.error || `Token request failed: ${r.status}`);
  }

  return data.access_token;
}

async function shopifyGetAll(endpoint, key) {
  const token = await getAccessToken();
  let results = [];
  let url = `${API}${endpoint}`;

  while (url) {
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token }
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Shopify ${r.status}: ${text}`);
    }

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
      since.setDate(since.getDate() - parseInt(days, 10));
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

    return res.status(400).json({ error: 'Unknown type' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
