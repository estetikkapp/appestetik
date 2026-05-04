'use client';

import * as React from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveConsent } from '@/actions/medical-info';

interface Props {
  clientId: string;
  alreadySignedAt?: string | null;
}

export function SignaturePad({ clientId, alreadySignedAt }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [signature, setSignature] = React.useState('');
  const [drawing, setDrawing] = React.useState(false);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#42201e';
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setDrawing(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignature('');
    }
  };

  return (
    <div className="space-y-3">
      {alreadySignedAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Consentimiento firmado el {new Date(alreadySignedAt).toLocaleDateString('es-AR')}.
          Podés volver a firmarlo si necesitás actualizarlo.
        </div>
      )}
      <div className="rounded-xl border border-stone-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-40 w-full cursor-crosshair touch-none rounded-xl"
          aria-label="Área para firmar"
        />
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="mr-2 h-4 w-4" />
          Borrar firma
        </Button>
        <form action={saveConsent}>
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="signature" value={signature} />
          <SubmitButton disabled={!signature} pendingText="Guardando...">
            Guardar consentimiento
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
