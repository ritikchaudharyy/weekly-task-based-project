const express = require('express');
const {
  DEFAULT_NEAR_LOW_THRESHOLD,
  getRecommendations,
  getPriceSummary,
  addWatchRule,
  simulatePriceDrop
} = require('../services/pricesenseService');

const router = express.Router();

router.get('/products/:productId/summary', (req, res) => {
  const threshold = Number(req.query.threshold || DEFAULT_NEAR_LOW_THRESHOLD);
  const summary = getPriceSummary(req.params.productId, threshold);
  if (!summary) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  return res.json({ success: true, data: summary });
});

router.get('/recommendations', (req, res) => {
  const budget = req.query.budget ? Number(req.query.budget) : undefined;
  const brand = req.query.brand;
  const threshold = req.query.threshold ? Number(req.query.threshold) : DEFAULT_NEAR_LOW_THRESHOLD;
  const recommendations = getRecommendations({ budget, brand, threshold });
  return res.json({ success: true, data: recommendations });
});

router.post('/watchlist', (req, res) => {
  const { user_id, product_id, target_price, notify_on_new_low, notification_window } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({ success: false, message: 'user_id and product_id are required' });
  }

  const watch = addWatchRule({
    user_id,
    product_id,
    target_price,
    notify_on_new_low,
    notification_window
  });

  return res.status(201).json({ success: true, data: watch });
});

router.post('/simulate-price-drop', (req, res) => {
  const { product_id, marketplace, new_price } = req.body;
  if (!product_id || !marketplace || typeof new_price !== 'number') {
    return res.status(400).json({ success: false, message: 'product_id, marketplace, and numeric new_price are required' });
  }

  const result = simulatePriceDrop({ product_id, marketplace, new_price });
  if (!result.updated) {
    return res.status(404).json({ success: false, message: 'Marketplace listing not found' });
  }

  return res.json({
    success: true,
    data: result,
    popup_template: {
      title: 'Price Drop Alert',
      body: `${product_id} is now at ₹${new_price} on ${marketplace}.`,
      actions: ['Buy', 'Snooze', 'Stop watching']
    }
  });
});

module.exports = router;
