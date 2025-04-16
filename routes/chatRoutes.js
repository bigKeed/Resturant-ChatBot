const express = require('express');
const router = express.Router();
const chatController = require('../controller/chatController');

router.get('/chatbot', chatController.startChat);
router.post('/chatbot', chatController.handleMessage);
router.get('/pay/:orderId', chatController.initiatePayment);
router.get('/verify-payment', chatController.verifyPayment);

module.exports = router;