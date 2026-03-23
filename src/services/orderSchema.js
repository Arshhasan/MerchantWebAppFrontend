export const resolveOrderVendorId = (order = {}) => {
  return (
    order.vendorID ||
    order.vendor_id ||
    order.restaurantId ||
    order.vendor?.vendorID ||
    order.vendor?.id ||
    order.vendor?.author ||
    null
  );
};

export const resolveOrderDocId = (order = {}) => {
  return order._docId || order.orderId || order.id || null;
};
