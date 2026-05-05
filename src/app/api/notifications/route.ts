import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[notifications GET]', error);
    return NextResponse.json({ error: 'Error al cargar' }, { status: 500 });
  }

  const unreadCount = data?.filter((n) => !n.read_at).length ?? 0;

  return NextResponse.json({ notifications: data ?? [], unread_count: unreadCount });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  const id = body.id as string | undefined;

  const now = new Date().toISOString();

  if (action === 'mark_all_read') {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) {
      console.error('[notifications mark_all_read]', error);
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_read' && id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      console.error('[notifications mark_read]', error);
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
}
