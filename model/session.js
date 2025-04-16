const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
});

module.exports = mongoose.model('Session', sessionSchema);