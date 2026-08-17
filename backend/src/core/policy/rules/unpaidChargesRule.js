/**
 * Unpaid Charges Policy Rule
 * Mandatory outstanding check-out policy checks
 */
export const unpaidChargesRule = (context, bookingDetails) => {
  if (!bookingDetails) {
    return { passed: false, message: 'Booking details not provided.' };
  }

  // If pending balance is greater than 0, block check-out unless overridden by Super/Hotel Admin
  const pending = parseFloat(bookingDetails.pendingBalance || 0);
  const userRole = context.role;

  if (pending > 0 && userRole !== 'admin' && userRole !== 'super-admin') {
    return { 
      passed: false, 
      message: `Booking has unpaid pending balance of ${pending} INR. Scoped reception checkout blocked.` 
    };
  }

  return { passed: true, message: 'Checkout unpaid charges validation passed.' };
};
