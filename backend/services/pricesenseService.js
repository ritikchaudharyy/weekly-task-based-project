const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NEAR_LOW_THRESHOLD = 0.03;

const state = {
  users: new Map(),
  watchRules: [],
  products: [
    {
      product_id: 'vivo-v4-ultra-256',
      title: 'Vivo V4 Ultra 5G (12GB/256GB)',
      brand: 'Vivo',
      model: 'V4 Ultra',
      category: 'smartphone',
      specs: {
        camera_mp: 64,
        cpu: 'Snapdragon 8 Gen 2',
        ram: 12,
        storage: 256,
        display: '6.7 AMOLED'
      },
      quality: {
        camera_score: 88,
        design_score: 85,
        performance_score: 82,
        rating: 4.4
      },
      images: [],
      marketplace_ids: []
    },
    {
      product_id: 'vivo-y200-pro-128',
      title: 'Vivo Y200 Pro (8GB/128GB)',
      brand: 'Vivo',
      model: 'Y200 Pro',
      category: 'smartphone',
      specs: { camera_mp: 50, cpu: 'Snapdragon 6 Gen 1', ram: 8, storage: 128, display: '6.6 AMOLED' },
      quality: { camera_score: 79, design_score: 80, performance_score: 74, rating: 4.2 },
      images: [],
      marketplace_ids: []
    }
  ],
  marketplacePrices: [],
  priceHistory: new Map()
};

function seedData() {
  if (state.marketplacePrices.length > 0) return;
  const now = Date.now();
  const marketplaces = ['amazon.in', 'flipkart.in', 'blinkit.in', 'zepto.in', 'swiggy-instamart', 'chroma.in', 'jiomart'];

  marketplaces.forEach((marketplace) => {
    state.marketplacePrices.push({
      product_id: 'vivo-v4-ultra-256',
      marketplace,
      marketplace_product_id: `${marketplace}-v4-ultra`,
      price: marketplace === 'flipkart.in' ? 31999 : marketplace === 'amazon.in' ? 32999 : 33499,
      currency: 'INR',
      availability: marketplace === 'blinkit.in' ? 'limited' : 'in_stock',
      delivery_info: marketplace.includes('instamart') ? 'Today' : '1-3 days',
      timestamp: new Date(now).toISOString(),
      url: `https://${marketplace}/vivo-v4-ultra`
    });
  });

  const history = [];
  for (let d = 0; d < 365; d++) {
    const date = new Date(now - d * DAY_MS);
    const base = 38000 - Math.floor(d / 8) * 120;
    const min_price = Math.max(31499, base + (d % 5) * 40);
    const max_price = min_price + 1200;
    const avg_price = Math.round((min_price + max_price) / 2);
    history.push({
      product_id: 'vivo-v4-ultra-256',
      date: date.toISOString().slice(0, 10),
      min_price,
      avg_price,
      max_price
    });
  }
  history[30].min_price = 31499;
  state.priceHistory.set('vivo-v4-ultra-256', history);

  const y200History = [];
  for (let d = 0; d < 365; d++) {
    const date = new Date(now - d * DAY_MS);
    const min_price = 22999 + (d % 10) * 60;
    y200History.push({
      product_id: 'vivo-y200-pro-128',
      date: date.toISOString().slice(0, 10),
      min_price,
      avg_price: min_price + 500,
      max_price: min_price + 950
    });
  }
  state.priceHistory.set('vivo-y200-pro-128', y200History);
  state.marketplacePrices.push({
    product_id: 'vivo-y200-pro-128',
    marketplace: 'amazon.in',
    marketplace_product_id: 'amazon-vivo-y200-pro',
    price: 23999,
    currency: 'INR',
    availability: 'in_stock',
    delivery_info: '2 days',
    timestamp: new Date(now).toISOString(),
    url: 'https://amazon.in/vivo-y200-pro'
  });
}

function computeQualityScore(quality, weights = { camera: 0.4, performance: 0.35, design: 0.25 }) {
  return (
    quality.camera_score * weights.camera +
    quality.performance_score * weights.performance +
    quality.design_score * weights.design
  );
}

function getCurrentLowestOffer(productId, excludedMarketplaces = []) {
  const excluded = new Set(excludedMarketplaces);
  const offers = state.marketplacePrices
    .filter((item) => item.product_id === productId && item.availability !== 'out_of_stock' && !excluded.has(item.marketplace))
    .sort((a, b) => a.price - b.price);
  return offers[0] || null;
}

function getTwelveMonthLow(productId) {
  const history = state.priceHistory.get(productId) || [];
  const low = history.reduce((acc, entry) => {
    if (!acc || entry.min_price < acc.min_price) {
      return { min_price: entry.min_price, date: entry.date };
    }
    return acc;
  }, null);
  return low;
}

function getProximity(currentPrice, lowPrice) {
  if (!lowPrice) return null;
  return (currentPrice - lowPrice) / lowPrice;
}

function getRecommendations({ budget, brand, threshold = DEFAULT_NEAR_LOW_THRESHOLD, weights, excludedMarketplaces = [] }) {
  const matches = state.products
    .filter((product) => (!brand || product.brand.toLowerCase() === brand.toLowerCase()))
    .map((product) => {
      const lowestOffer = getCurrentLowestOffer(product.product_id, excludedMarketplaces);
      if (!lowestOffer) return null;
      const low12m = getTwelveMonthLow(product.product_id);
      if (!low12m) return null;
      const proximity = getProximity(lowestOffer.price, low12m.min_price);
      const qualityScore = computeQualityScore(product.quality, weights);
      const inBudget = !budget || lowestOffer.price <= budget;

      const recommendationScore =
        (qualityScore / 100) * 0.6 +
        Math.max(0, 1 - Math.max(proximity, 0) / threshold) * 0.4 -
        (inBudget ? 0 : 0.4);

      return {
        product,
        lowestOffer,
        low12m,
        proximity,
        nearLowest: proximity <= threshold,
        inBudget,
        qualityScore: Number(qualityScore.toFixed(1)),
        recommendationScore: Number(recommendationScore.toFixed(3))
      };
    })
    .filter(Boolean)
    .filter((item) => item.inBudget)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .map((item) => ({
      product_id: item.product.product_id,
      title: item.product.title,
      brand: item.product.brand,
      category: item.product.category,
      quality_score: item.qualityScore,
      recommendation_score: item.recommendationScore,
      current_lowest_price: item.lowestOffer.price,
      current_lowest_marketplace: item.lowestOffer.marketplace,
      buy_url: item.lowestOffer.url,
      twelve_month_low_price: item.low12m.min_price,
      twelve_month_low_date: item.low12m.date,
      proximity: Number(item.proximity.toFixed(4)),
      reason_tags: [
        item.nearLowest ? 'near_12m_low' : 'not_near_12m_low',
        'budget_match',
        'quality_weighted_score'
      ]
    }));

  return matches;
}

function addWatchRule({ user_id, product_id, target_price, notify_on_new_low = true, notification_window = '08:00-22:00' }) {
  const rule = {
    watch_id: `watch-${Date.now()}`,
    user_id,
    product_id,
    target_price,
    notify_on_new_low,
    notification_window,
    created_at: new Date().toISOString()
  };
  state.watchRules.push(rule);
  return rule;
}

function simulatePriceDrop({ product_id, marketplace, new_price }) {
  const idx = state.marketplacePrices.findIndex(
    (item) => item.product_id === product_id && item.marketplace === marketplace
  );

  if (idx === -1) return { updated: null, alerts: [] };

  state.marketplacePrices[idx].price = new_price;
  state.marketplacePrices[idx].timestamp = new Date().toISOString();

  const low12m = getTwelveMonthLow(product_id);
  const alerts = state.watchRules
    .filter((rule) => rule.product_id === product_id)
    .filter((rule) => (rule.target_price ? new_price <= rule.target_price : false) || (rule.notify_on_new_low && new_price <= low12m.min_price))
    .map((rule) => ({
      user_id: rule.user_id,
      watch_id: rule.watch_id,
      message: `${product_id} is now at ₹${new_price} on ${marketplace}.`,
      product_id,
      marketplace,
      price: new_price
    }));

  return { updated: state.marketplacePrices[idx], alerts };
}

function getPriceSummary(productId, threshold = DEFAULT_NEAR_LOW_THRESHOLD) {
  const product = state.products.find((p) => p.product_id === productId);
  if (!product) return null;
  const low12m = getTwelveMonthLow(productId);
  const lowestOffer = getCurrentLowestOffer(productId);
  if (!low12m || !lowestOffer) return null;
  const proximity = getProximity(lowestOffer.price, low12m.min_price);

  return {
    product,
    lowest_offer: lowestOffer,
    twelve_month_low: low12m,
    proximity,
    near_lowest: proximity <= threshold,
    comparison_table: state.marketplacePrices
      .filter((entry) => entry.product_id === productId)
      .sort((a, b) => a.price - b.price),
    history: state.priceHistory.get(productId) || []
  };
}

seedData();

module.exports = {
  DEFAULT_NEAR_LOW_THRESHOLD,
  computeQualityScore,
  getRecommendations,
  getPriceSummary,
  addWatchRule,
  simulatePriceDrop,
  getTwelveMonthLow,
  getProximity
};
