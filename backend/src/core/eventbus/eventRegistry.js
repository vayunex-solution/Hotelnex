/**
 * PropertyNex Platform Standard Event Registry
 * Defines supported system events
 */
export const SYSTEM_EVENTS = {
  BOOKING_CREATED: 'BookingCreated',
  BOOKING_CHECKED_IN: 'BookingCheckedIn',
  BOOKING_CHECKED_OUT: 'BookingCheckedOut',
  GUEST_CREATED: 'GuestCreated',
  GUEST_UPDATED: 'GuestUpdated',
  INVOICE_GENERATED: 'InvoiceGenerated',
  PAYMENT_RECEIVED: 'PaymentReceived',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  RECEIVABLE_CREATED: 'ReceivableCreated',
  RECEIVABLE_SETTLED: 'ReceivableSettled',
  CASH_DRAWER_OPENED: 'CashDrawerOpened',
  CASH_DRAWER_CLOSED: 'CashDrawerClosed',
  ROOM_STATUS_CHANGED: 'RoomStatusChanged',
  TENANT_CREATED: 'TenantCreated',
};

/**
 * Basic event payload validation schema rules
 */
export const validateEventPayload = (eventName, payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Event payload must be a non-null object.`);
  }

  // Basic check for required common properties
  switch (eventName) {
    case SYSTEM_EVENTS.BOOKING_CREATED:
    case SYSTEM_EVENTS.BOOKING_CHECKED_IN:
    case SYSTEM_EVENTS.BOOKING_CHECKED_OUT:
      if (!payload.bookingId) throw new Error('Missing bookingId in payload');
      break;
    case SYSTEM_EVENTS.GUEST_CREATED:
    case SYSTEM_EVENTS.GUEST_UPDATED:
      if (!payload.guestId) throw new Error('Missing guestId in payload');
      break;
    case SYSTEM_EVENTS.INVOICE_GENERATED:
      if (!payload.invoiceId) throw new Error('Missing invoiceId in payload');
      break;
    case SYSTEM_EVENTS.TENANT_CREATED:
      if (!payload.tenantId) throw new Error('Missing tenantId in payload');
      break;
    case SYSTEM_EVENTS.PAYMENT_RECEIVED:
    case SYSTEM_EVENTS.PAYMENT_REFUNDED:
      if (payload.amount === undefined) throw new Error('Missing amount in payment event payload');
      break;
    case SYSTEM_EVENTS.RECEIVABLE_CREATED:
    case SYSTEM_EVENTS.RECEIVABLE_SETTLED:
      if (!payload.receivableId) throw new Error('Missing receivableId in receivable event payload');
      break;
    case SYSTEM_EVENTS.CASH_DRAWER_OPENED:
    case SYSTEM_EVENTS.CASH_DRAWER_CLOSED:
      if (!payload.drawerId) throw new Error('Missing drawerId in cash drawer event payload');
      break;
  }
  return true;
};
