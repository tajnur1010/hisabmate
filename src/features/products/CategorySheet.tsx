import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, ConfirmDialog, Input, Sheet } from '@/components/ui';

/**
 * Create and remove product categories. Deleting a category never deletes its
 * products — they simply become uncategorized, mirroring the database's
 * ON DELETE SET NULL.
 */
export function CategorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { productCategories, products, createProductCategory, deleteProductCategory } = useData();
  const toast = useToast();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSaving(false);
    setRemovingId(null);
    setBusy(false);
  }, [open]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      await createProductCategory({ name });
      setName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      toast.error(/exist|duplicate|unique/i.test(message) ? t('product.categoryExists') : message || t('error.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!removingId) return;
    setBusy(true);
    try {
      await deleteProductCategory(removingId);
      setRemovingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const countFor = (categoryId: string) =>
    products.filter((p) => !p.archived && p.categoryId === categoryId).length;

  return (
    <Sheet open={open} onClose={onClose} title={t('product.categories')}>
      <form onSubmit={onAdd} className="flex items-end gap-2 pb-4" noValidate>
        <Input
          label={t('product.categoryName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('product.newCategory')}
        />
        <Button type="submit" loading={saving} disabled={!name.trim()} className="shrink-0">
          <Plus size={16} />
        </Button>
      </form>

      {productCategories.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">{t('product.noCategories')}</p>
      ) : (
        <ul className="space-y-2 pb-2">
          {productCategories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.name}</span>
              <span className="font-num tabular text-xs text-faint">{countFor(c.id)}</span>
              <button
                type="button"
                onClick={() => setRemovingId(c.id)}
                aria-label={t('common.delete')}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removingId}
        onClose={() => setRemovingId(null)}
        onConfirm={onRemove}
        title={t('common.delete')}
        description={t('product.deleteCategoryConfirm')}
        confirmLabel={t('common.delete')}
        loading={busy}
        icon={<Trash2 size={22} />}
      />
    </Sheet>
  );
}
