const Order = require("../model/order");
const Session = require("../model/session");
const axios = require("axios");

// Simulated menu
const menu = [
  { id: 10, name: "Jollof Rice with Chicken", price: 3200 },
  { id: 12, name: "Fried Rice with Turkey", price: 4500 },
  { id: 13, name: "Pounded Yam with Egusi Soup", price: 1800 },
  { id: 14, name: "Eba with Vegetable Soup", price: 1000 },
  { id: 15, name: "Pepper Soup (Catfish)", price: 1600 },
  { id: 16, name: "Moi Moi", price: 500 },
  { id: 17, name: "Akara (Bean Cakes)", price: 300 },
  { id: 18, name: "Small Chops (Samosa, Spring Rolls, Puff Puff)", price: 800 },
  { id: 19, name: "Nkwobi", price: 2000 },
  { id: 110, name: "Isiewu (Goat Head)", price: 2500 },
  { id: 111, name: "Plantain (Fried/Boiled)", price: 400 },
  { id: 112, name: "Yam Porridge", price: 900 },
  { id: 113, name: "Garri and Groundnut", price: 300 },
  { id: 114, name: "Zobo Drink", price: 400 },
  { id: 115, name: "Chapman", price: 600 },
];

// Welcome message options
const welcomeOptions = [
  { id: 1, text: "Place an order" },
  { id: 99, text: "Checkout order" },
  { id: 98, text: "See order history" },
  { id: 97, text: "See current order" },
  { id: 0, text: "Cancel order" },
];

exports.startChat = async (req, res) => {
  let session = await Session.findOne({ sessionId: req.sessionID });
  if (!session) {
    session = await Session.create({ sessionId: req.sessionID });
  }
  console.log("startChat - Session ID:", req.sessionID);
  res.render("chat", {
    messages: [{ type: "welcome", content: welcomeOptions }],
    sessionId: req.sessionID,
    session,
  });
};

exports.handleMessage = async (req, res) => {
  const { message } = req.body;
  const sessionId = req.sessionID;
  let session = await Session.findOne({ sessionId });
  let messages = [];

  if (!session) {
    session = await Session.create({ sessionId });
    console.log("handleMessage - Created new session:", sessionId);
  }

  console.log("handleMessage - Session ID:", sessionId, "Input:", message);

  // Input validation
  const option = parseInt(message);
  if (isNaN(option)) {
    messages.push({ type: "welcome", content: welcomeOptions });
    return res.render("chat", { messages, sessionId, session });
  }

  switch (option) {
    case 1:
      messages.push({
        type: "menu",
        content: menu.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
        })),
      });
      break;

    case 99:
      const order = await Order.findOne({ sessionId, status: "pending" });
      console.log("Checkout - Order:", order ? {
        id: order._id,
        items: order.items,
        total: order.total,
        status: order.status
      } : "No order found");
      if (order && order.items.length > 0) {
        order.status = "placed";
        order.paymentStatus = "pending";
        await order.save();
        session.currentOrder = null;
        await session.save();
        messages.push({
          type: "text",
          content: `Order placed! Total: N${order.total}\n<a href="/pay/${order._id}">Pay Now</a>\nSelect 1 to place a new order.`,
        });
      } else {
        messages.push({
          type: "text",
          content: "No order to place. Please add items to your order first.",
        });
        messages.push({ type: "welcome", content: welcomeOptions });
      }
      break;

    case 98:
      const orders = await Order.find({ sessionId, status: "placed" });
      const history =
        orders.length > 0
          ? "Order History:\n" +
            orders
              .map(
                (o) =>
                  `Order #${o._id}: ${o.items
                    .map((i) => i.name)
                    .join(", ")} (N${o.total})`
              )
              .join("\n")
          : "No orders found.";
      messages.push({ type: "text", content: history });
      messages.push({ type: "welcome", content: welcomeOptions });
      break;

    case 97:
      const currentOrder = await Order.findOne({
        sessionId,
        status: "pending",
      });
      const current =
        currentOrder && currentOrder.items.length > 0
          ? `Current Order: ${currentOrder.items
              .map((i) => i.name)
              .join(", ")} (N${currentOrder.total})`
          : "No current order.";
      messages.push({ type: "text", content: current });
      messages.push({ type: "welcome", content: welcomeOptions });
      break;

    case 0:
      const cancelledOrder = await Order.findOne({
        sessionId,
        status: "pending",
      });
      if (cancelledOrder) {
        cancelledOrder.status = "cancelled";
        await cancelledOrder.save();
        session.currentOrder = null;
        await session.save();
        messages.push({ type: "text", content: "Order cancelled." });
      } else {
        messages.push({ type: "text", content: "No order to cancel." });
      }
      messages.push({ type: "welcome", content: welcomeOptions });
      break;

    default:
      // Check if the option is a menu item
      const selectedItem = menu.find((item) => item.id === option);
      if (selectedItem) {
        let order = await Order.findOne({ sessionId, status: "pending" });
        if (!order) {
          order = await Order.create({ sessionId, items: [], total: 0 });
          session.currentOrder = order._id;
          await session.save();
          console.log("Created new order:", {
            id: order._id,
            sessionId,
            itemAdded: selectedItem.name,
          });
        }
        order.items.push({
          name: selectedItem.name,
          price: selectedItem.price,
        });
        order.total += selectedItem.price;
        await order.save();
        console.log("Updated order:", {
          id: order._id,
          items: order.items.map((i) => i.name),
          total: order.total,
        });
        messages.push({
          type: "text",
          content: `${selectedItem.name} added to order. Total: N${order.total}`,
        });
        messages.push({ type: "welcome", content: welcomeOptions });
      } else {
        messages.push({ type: "text", content: "Invalid option." });
        messages.push({ type: "welcome", content: welcomeOptions });
      }
  }

  res.render("chat", { messages, sessionId, session });
};

// Paystack payment initialization
exports.initiatePayment = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || order.paymentStatus !== "pending") {
    return res.redirect("/chatbot?message=No valid order for payment");
  }

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: "edwin.resturant@gmail.com",
        amount: order.total * 100, // Paystack expects amount in kobo
        reference: `order_${order._id}`,
        callback_url: `${process.env.APP_URL}/verify-payment`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.redirect(response.data.data.authorization_url);
  } catch (error) {
    console.error("Paystack Initialization Error:", error.response?.data || error.message);
    res.redirect("/chatbot?message=Payment initiation failed");
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  const { reference } = req.query;
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.data.status === "success") {
      const orderId = reference.replace("order_", "");
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = "paid";
        await order.save();
        res.redirect(
          "/chatbot?message=Payment successful! Thank you for your order."
        );
      } else {
        res.redirect("/chatbot?message=Order not found");
      }
    } else {
      console.error("Paystack Verification Failed:", response.data);
      res.redirect("/chatbot?message=Payment failed");
    }
  } catch (error) {
    console.error("Paystack Verification Error:", error.response?.data || error.message);
    res.redirect("/chatbot?message=Payment verification failed");
  }
};