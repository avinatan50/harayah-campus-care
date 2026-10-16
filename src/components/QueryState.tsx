import { Button } from '@/components/ui/button';
export function QueryState({ loading, error, retry }: { loading: boolean; error: unknown; retry: () => unknown }) {
  if (loading) return <p className="py-6 text-muted-foreground">טוען…</p>;
  if (error) return <div role="alert" className="py-6 text-destructive">הטעינה נכשלה. <Button variant="outline" size="sm" onClick={retry}>ניסיון חוזר</Button></div>;
  return null;
}