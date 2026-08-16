import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, HelpCircle, Mail, MessageCircle, Phone } from 'lucide-react';
import type { Language } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { Card, IconButton } from '@/components/ui';
import { availableSupportMethods } from '@/config/support';
import type { SupportMethodKind } from '@/config/support';

interface QA {
  q: string;
  a: string;
}

/**
 * Bilingual, hand-written help content. Every answer describes a feature that
 * actually exists in HisabMate — no placeholder or invented guidance.
 */
const FAQ: Record<Language, QA[]> = {
  en: [
    {
      q: 'How do I add a customer or supplier?',
      a: 'Open the Customers or Suppliers tab and tap “Add”. Enter a name — phone number and opening balance are optional — then save.',
    },
    {
      q: 'How do I record a credit sale or a payment?',
      a: 'Tap the + button in the middle of the bottom bar, choose Credit sale, Money received or Money paid, pick the person and enter the amount.',
    },
    {
      q: 'How is a balance calculated?',
      a: 'Balances are worked out automatically from the opening balance plus every transaction. You never edit a balance by hand, so it always matches the ledger.',
    },
    {
      q: 'What do “You’ll get” and “You’ll give” mean?',
      a: '“You’ll get” is money customers owe you (receivable). “You’ll give” is money you owe your suppliers (payable).',
    },
    {
      q: 'How do I send a payment reminder?',
      a: 'Open a customer who has an outstanding balance and tap Remind. You can edit the message wording in Settings → Reminders.',
    },
    {
      q: 'Does the app work offline?',
      a: 'Yes. Your data is stored on your device, so you can add and view entries without internet. If cloud sync is turned on, changes sync when you’re back online.',
    },
    {
      q: 'How do I back up or export my data?',
      a: 'Go to Settings → Data → Export. This downloads a full copy of your data as a file you can keep somewhere safe.',
    },
    {
      q: 'How do I download a report?',
      a: 'Open the Reports tab, choose Daily, Weekly or Monthly, then tap Download to save it as a PDF.',
    },
    {
      q: 'How do I change language, theme or numerals?',
      a: 'Settings → Appearance lets you switch between English and বাংলা, light and dark themes, and Bengali numerals.',
    },
  ],
  bn: [
    {
      q: 'কাস্টমার বা সাপ্লায়ার কীভাবে যোগ করব?',
      a: 'কাস্টমার বা সাপ্লায়ার ট্যাবে গিয়ে “যোগ করুন”-এ চাপুন। নাম দিন — ফোন নম্বর ও প্রারম্ভিক ব্যালেন্স ঐচ্ছিক — তারপর সেভ করুন।',
    },
    {
      q: 'বাকিতে বিক্রি বা টাকা লেনদেন কীভাবে লিখব?',
      a: 'নিচের বারের মাঝের + বাটনে চাপুন, তারপর বাকিতে বিক্রি / টাকা পেলাম / টাকা দিলাম বেছে ব্যক্তি ও পরিমাণ দিন।',
    },
    {
      q: 'ব্যালেন্স কীভাবে হিসাব হয়?',
      a: 'প্রারম্ভিক ব্যালেন্স ও সব লেনদেন থেকে ব্যালেন্স স্বয়ংক্রিয়ভাবে বের হয়। আপনি হাতে ব্যালেন্স বদলান না, তাই এটি সবসময় খাতার সাথে মেলে।',
    },
    {
      q: '“পাবেন” আর “দেবেন” মানে কী?',
      a: '“পাবেন” = কাস্টমারের কাছে আপনার পাওনা। “দেবেন” = সাপ্লায়ারকে আপনার দেনা।',
    },
    {
      q: 'পেমেন্ট রিমাইন্ডার কীভাবে পাঠাব?',
      a: 'বকেয়া আছে এমন কাস্টমার খুলে “তাগাদা”-এ চাপুন। মেসেজের ভাষা Settings → Reminders-এ বদলাতে পারবেন।',
    },
    {
      q: 'অ্যাপ কি অফলাইনে চলে?',
      a: 'হ্যাঁ। ডেটা আপনার ফোনেই থাকে, তাই ইন্টারনেট ছাড়াই এন্ট্রি করা ও দেখা যায়। ক্লাউড সিঙ্ক চালু থাকলে অনলাইনে ফিরলে পরিবর্তন সিঙ্ক হয়।',
    },
    {
      q: 'ডেটা ব্যাকআপ বা এক্সপোর্ট কীভাবে করব?',
      a: 'Settings → Data → Export-এ যান। এটি আপনার সব ডেটার একটি সম্পূর্ণ কপি ফাইল হিসেবে নামিয়ে দেবে, যা নিরাপদে রাখতে পারবেন।',
    },
    {
      q: 'রিপোর্ট কীভাবে ডাউনলোড করব?',
      a: 'Reports ট্যাব খুলে দৈনিক, সাপ্তাহিক বা মাসিক বেছে “ডাউনলোড”-এ চাপুন — PDF হিসেবে সেভ হবে।',
    },
    {
      q: 'ভাষা, থিম বা সংখ্যা কীভাবে বদলাব?',
      a: 'Settings → Appearance থেকে English ও বাংলা, লাইট ও ডার্ক থিম, এবং বাংলা সংখ্যা বদলানো যায়।',
    },
  ],
};

const METHOD_META: Record<SupportMethodKind, { icon: ReactNode; label: Record<Language, string> }> = {
  phone: { icon: <Phone size={18} />, label: { en: 'Call', bn: 'কল করুন' } },
  whatsapp: { icon: <MessageCircle size={18} />, label: { en: 'WhatsApp', bn: 'হোয়াটসঅ্যাপ' } },
  email: { icon: <Mail size={18} />, label: { en: 'Email', bn: 'ইমেইল' } },
  website: { icon: <Globe size={18} />, label: { en: 'Website', bn: 'ওয়েবসাইট' } },
};

/** Help & support: a usage guide (FAQ) plus any support contact the shop has set. */
export default function Help() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const methods = availableSupportMethods();
  const faqs = FAQ[lang] ?? FAQ.en;

  return (
    <div className="space-y-6 px-4 py-4 pb-10">
      <header className="flex items-center gap-2">
        <IconButton size="sm" label={t('common.back')} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">{t('help.title')}</h1>
          <p className="truncate text-sm text-muted">{t('help.subtitle')}</p>
        </div>
      </header>

      {/* Contact support — shows only the methods filled into src/config/support.ts */}
      <section className="space-y-2.5">
        <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold text-muted">
          <HelpCircle size={15} />
          {t('help.contact')}
        </h2>
        {methods.length > 0 ? (
          <Card padded={false} className="divide-y divide-line">
            {methods.map((m) => (
              <a
                key={m.kind}
                href={m.href}
                target={m.kind === 'website' || m.kind === 'whatsapp' ? '_blank' : undefined}
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  {METHOD_META[m.kind].icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {METHOD_META[m.kind].label[lang]}
                  </span>
                  <span className="block truncate text-xs text-muted">{m.value}</span>
                </span>
              </a>
            ))}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-muted">{t('help.noContact')}</p>
          </Card>
        )}
      </section>

      {/* Usage guide */}
      <section className="space-y-2.5">
        <h2 className="px-1 text-sm font-semibold text-muted">{t('help.faq')}</h2>
        <div className="space-y-2.5">
          {faqs.map((item, i) => (
            <Card key={i} className="space-y-1.5">
              <p className="text-sm font-semibold text-ink">{item.q}</p>
              <p className="text-sm leading-relaxed text-muted">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
