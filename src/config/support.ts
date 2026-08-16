/**
 * Support / helpline contact for this shop.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  FILL IN YOUR REAL CONTACT DETAILS BELOW.                            │
 * │  Any field left as an empty string ('') is hidden in the app —      │
 * │  HisabMate never shows a made-up phone number or email.             │
 * │  This file is the ONLY place to edit; the Help page reads from here.│
 * └─────────────────────────────────────────────────────────────────────┘
 */
export interface SupportContact {
  /** Phone number, e.g. '+8801XXXXXXXXX'. Shown as a tap-to-call link. */
  phone: string;
  /** WhatsApp number with country code, digits only, e.g. '8801XXXXXXXXX'. */
  whatsapp: string;
  /** Support email address, e.g. 'support@yourshop.com'. */
  email: string;
  /** Website or Facebook page, e.g. 'facebook.com/yourshop'. */
  website: string;
}

/** Edit these values. Leave a field as '' to hide it. */
export const support: SupportContact = {
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
};

export type SupportMethodKind = 'phone' | 'whatsapp' | 'email' | 'website';

export interface SupportMethod {
  kind: SupportMethodKind;
  /** Human-readable value to display. */
  value: string;
  /** Ready-to-use href (tel:, https://wa.me/, mailto:, https://…). */
  href: string;
}

/**
 * Returns only the contact methods that have actually been filled in.
 * Nothing is ever fabricated — an empty config yields an empty list, and the
 * Help page shows a neutral "no contact yet" note in that case.
 */
export function availableSupportMethods(contact: SupportContact = support): SupportMethod[] {
  const methods: SupportMethod[] = [];

  const phone = contact.phone.trim();
  if (phone) methods.push({ kind: 'phone', value: phone, href: `tel:${phone.replace(/\s+/g, '')}` });

  const whatsapp = contact.whatsapp.replace(/\D+/g, '');
  if (whatsapp) methods.push({ kind: 'whatsapp', value: `+${whatsapp}`, href: `https://wa.me/${whatsapp}` });

  const email = contact.email.trim();
  if (email) methods.push({ kind: 'email', value: email, href: `mailto:${email}` });

  const website = contact.website.trim();
  if (website) {
    const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    methods.push({ kind: 'website', value: website, href });
  }

  return methods;
}
