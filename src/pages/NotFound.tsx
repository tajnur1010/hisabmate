import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { Button, EmptyState } from '@/components/ui';

export default function NotFound() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-full place-items-center px-6 py-16">
      <EmptyState
        icon={<Compass size={28} />}
        title={t('error.notFound')}
        description={t('error.notFoundDesc')}
        action={<Button onClick={() => navigate('/')}>{t('error.goHome')}</Button>}
      />
    </div>
  );
}
