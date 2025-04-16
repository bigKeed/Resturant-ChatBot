const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  items: [{ name: String, price: Number }],
  total: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  paymentStatus: { type: String, default: 'unpaid' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);