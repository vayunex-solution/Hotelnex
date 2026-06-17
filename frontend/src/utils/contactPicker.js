export const isContactPickerSupported = () => {
  return typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
};

export const pickContact = async () => {
  if (!isContactPickerSupported()) {
    throw new Error('Contact Picker is not supported on this browser/device.');
  }

  try {
    // Select name and tel (telephone number) fields
    const props = ['name', 'tel'];
    const contacts = await navigator.contacts.select(props, { multiple: false });
    if (contacts && contacts.length > 0) {
      const contact = contacts[0];
      const name = contact.name && contact.name[0] ? contact.name[0] : '';
      let phone = contact.tel && contact.tel[0] ? contact.tel[0] : '';
      
      // Clean formatting spaces and hyphens from the phone number
      if (phone) {
        phone = phone.replace(/[\s()\-]/g, '');
      }
      
      return { name, phone };
    }
  } catch (err) {
    console.error('[ContactPicker] Error picking contact:', err);
    throw err;
  }
  return null;
};
