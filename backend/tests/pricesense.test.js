const assert = require('assert');
const {
  computeQualityScore,
  getRecommendations,
  getTwelveMonthLow,
  getProximity,
  addWatchRule,
  simulatePriceDrop
} = require('../services/pricesenseService');

const quality = computeQualityScore({ camera_score: 88, performance_score: 82, design_score: 85 });
assert(Math.abs(quality - 85.15) < 0.01, 'Quality score formula mismatch');

const low = getTwelveMonthLow('vivo-v4-ultra-256');
assert(low.min_price === 31499, '12-month low should be seeded as 31499');

const proximity = getProximity(31999, 31499);
assert(proximity < 0.03, '31999 should be near low with default 3% threshold');

const recommendations = getRecommendations({ budget: 35000, brand: 'Vivo' });
assert(recommendations.length >= 1, 'Expected at least one recommendation under budget');
assert(recommendations[0].reason_tags.includes('near_12m_low'), 'Top recommendation should be near low');

const watch = addWatchRule({ user_id: 'user-1', product_id: 'vivo-v4-ultra-256', target_price: 31499 });
assert(watch.watch_id, 'Watch rule should be created');

const simulation = simulatePriceDrop({ product_id: 'vivo-v4-ultra-256', marketplace: 'flipkart.in', new_price: 31450 });
assert(simulation.alerts.length >= 1, 'Price drop should trigger an alert');

console.log('PriceSense tests passed');
