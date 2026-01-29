'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export type AnnotationTool = 'brush' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'pin';

export interface PinWithComment {
  x: number;
  y: number;
  comment: string;
}

export interface FrameAnnotationResult {
  annotatedDataUrl: string;
  pinX?: number;
  pinY?: number;
  pinComment?: string;
  pins?: PinWithComment[];
}

interface FrameAnnotationEditorProps {
  imageDataUrl: string;
  onSave: (result: FrameAnnotationResult) => void;
  onCancel: () => void;
}

const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#000000'];
const STROKE_SIZES = [2, 4, 6, 8, 12];

export function FrameAnnotationEditor({ imageDataUrl, onSave, onCancel }: FrameAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<AnnotationTool>('brush');
  const [color, setColor] = useState('#dc2626');
  const [strokeSize, setStrokeSize] = useState(4);
  const [textValue, setTextValue] = useState('');
  const [pins, setPins] = useState<PinWithComment[]>([]);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinCommentInput, setPinCommentInput] = useState('');
  const isDrawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  /** Draw a map-pin shape at (x, y) with the pin tip at that point, plus comment bubble. */
  const drawPinWithComment = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, comment: string, index: number) => {
    const size = 24;
    const pinColor = '#dc2626';
    const pinBorder = '#991b1b';
    
    // Draw pin marker
    ctx.save();
    ctx.fillStyle = pinColor;
    ctx.strokeStyle = pinBorder;
    ctx.lineWidth = 2;
    
    // Pin head (circle)
    ctx.beginPath();
    ctx.arc(x, y - size * 0.6, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Pin point (triangle)
    ctx.beginPath();
    ctx.moveTo(x - size * 0.25, y - size * 0.35);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size * 0.25, y - size * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Pin number inside
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x, y - size * 0.6);
    
    // Draw comment bubble if comment exists
    if (comment.trim()) {
      const padding = 8;
      const maxWidth = 200;
      const lineHeight = 16;
      ctx.font = '13px sans-serif';
      
      // Word wrap
      const words = comment.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth - padding * 2) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      // Calculate bubble size
      let bubbleWidth = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > bubbleWidth) bubbleWidth = w;
      }
      bubbleWidth += padding * 2;
      const bubbleHeight = lines.length * lineHeight + padding * 2;
      
      // Position bubble to the right of pin, or left if near edge
      const canvas = ctx.canvas;
      let bubbleX = x + size * 0.5 + 8;
      let bubbleY = y - size - bubbleHeight / 2;
      if (bubbleX + bubbleWidth > canvas.width - 10) {
        bubbleX = x - size * 0.5 - 8 - bubbleWidth;
      }
      if (bubbleY < 10) bubbleY = 10;
      if (bubbleY + bubbleHeight > canvas.height - 10) {
        bubbleY = canvas.height - 10 - bubbleHeight;
      }
      
      // Draw bubble background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 2;
      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(bubbleX + radius, bubbleY);
      ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
      ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
      ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
      ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
      ctx.lineTo(bubbleX, bubbleY + radius);
      ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw comment text
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => {
        ctx.fillText(line, bubbleX + padding, bubbleY + padding + i * lineHeight);
      });
    }
    
    ctx.restore();
  }, []);

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const saveToUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStackRef.current.push(canvas.toDataURL('image/png'));
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }, []);

  const drawBaseImage = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageDataUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImageRef.current = img;
      const maxW = Math.min(800, container.clientWidth);
      const scale = Math.min(maxW / img.width, 600 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      undoStackRef.current = [canvas.toDataURL('image/png')];
    };
    img.onerror = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.fillText('Failed to load image', 10, 30);
      }
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const restoreFromUndo = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || undoStackRef.current.length <= 1 || !img) return;
    undoStackRef.current.pop();
    // Also remove the last pin if exists
    setPins(prev => prev.slice(0, -1));
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    if (!prev) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const restoreImg = new Image();
    restoreImg.onload = () => {
      ctx.drawImage(restoreImg, 0, 0);
    };
    restoreImg.src = prev;
  }, []);

  const clearAll = useCallback(() => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;
    setPins([]);
    setPendingPin(null);
    setPinCommentInput('');
    saveToUndo();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(canvas.toDataURL('image/png'));
  }, [saveToUndo]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tool === 'pin') {
      // Show comment input modal for this pin
      setPendingPin({ x, y });
      setPinCommentInput('');
      return;
    }

    if (tool === 'text') {
      const text = textValue.trim() || 'Text';
      saveToUndo();
      ctx.font = `${strokeSize * 4}px sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      undoStackRef.current.push(canvas.toDataURL('image/png'));
      return;
    }

    isDrawingRef.current = true;
    startRef.current = { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !startRef.current) return;
    const { x, y } = getCanvasPoint(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const start = startRef.current;

    if (tool === 'brush') {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      startRef.current = { x, y };
      return;
    }

    const lastState = undoStackRef.current[undoStackRef.current.length - 1];
    if (!lastState) return;
    
    // Capture values before async operation since refs may change
    const capturedStart = { ...start };
    const capturedTool = tool;
    const capturedColor = color;
    const capturedStrokeSize = strokeSize;
    
    const previewImg = new Image();
    previewImg.src = lastState;
    previewImg.onload = () => {
      ctx.drawImage(previewImg, 0, 0);
      ctx.strokeStyle = capturedColor;
      ctx.lineWidth = capturedStrokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (capturedTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(capturedStart.x, capturedStart.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (capturedTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(capturedStart.x, capturedStart.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        const angle = Math.atan2(y - capturedStart.y, x - capturedStart.x);
        const arrowLen = Math.min(20, capturedStrokeSize * 4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - arrowLen * Math.cos(angle - 0.4), y - arrowLen * Math.sin(angle - 0.4));
        ctx.moveTo(x, y);
        ctx.lineTo(x - arrowLen * Math.cos(angle + 0.4), y - arrowLen * Math.sin(angle + 0.4));
        ctx.stroke();
      } else if (capturedTool === 'rect') {
        ctx.strokeRect(capturedStart.x, capturedStart.y, x - capturedStart.x, y - capturedStart.y);
      } else if (capturedTool === 'circle') {
        const r = Math.sqrt((x - capturedStart.x) ** 2 + (y - capturedStart.y) ** 2);
        ctx.beginPath();
        ctx.arc(capturedStart.x, capturedStart.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    return;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !startRef.current) return;
    const { x, y } = getCanvasPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = baseImageRef.current;
    if (!canvas || !ctx || !img) {
      isDrawingRef.current = false;
      startRef.current = null;
      return;
    }

    const start = startRef.current;

    if (tool === 'brush') {
      saveToUndo();
      isDrawingRef.current = false;
      startRef.current = null;
      return;
    }

    const lastState = undoStackRef.current[undoStackRef.current.length - 1];
    if (!lastState) {
      isDrawingRef.current = false;
      startRef.current = null;
      return;
    }
    
    // Capture values before async operation and before resetting refs
    const capturedStart = { ...start };
    const capturedTool = tool;
    const capturedColor = color;
    const capturedStrokeSize = strokeSize;
    
    // Reset refs immediately (before async callback)
    isDrawingRef.current = false;
    startRef.current = null;
    
    const restoreImg = new Image();
    restoreImg.onload = () => {
      ctx.drawImage(restoreImg, 0, 0);
      ctx.strokeStyle = capturedColor;
      ctx.lineWidth = capturedStrokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (capturedTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(capturedStart.x, capturedStart.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (capturedTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(capturedStart.x, capturedStart.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        const angle = Math.atan2(y - capturedStart.y, x - capturedStart.x);
        const arrowLen = Math.min(20, capturedStrokeSize * 4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - arrowLen * Math.cos(angle - 0.4), y - arrowLen * Math.sin(angle - 0.4));
        ctx.moveTo(x, y);
        ctx.lineTo(x - arrowLen * Math.cos(angle + 0.4), y - arrowLen * Math.sin(angle + 0.4));
        ctx.stroke();
      } else if (capturedTool === 'rect') {
        ctx.strokeRect(capturedStart.x, capturedStart.y, x - capturedStart.x, y - capturedStart.y);
      } else if (capturedTool === 'circle') {
        const r = Math.sqrt((x - capturedStart.x) ** 2 + (y - capturedStart.y) ** 2);
        ctx.beginPath();
        ctx.arc(capturedStart.x, capturedStart.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      undoStackRef.current.push(canvas.toDataURL('image/png'));
    };
    restoreImg.src = lastState;
  };

  /** Confirm adding a pin with comment */
  const confirmPinWithComment = useCallback(() => {
    if (!pendingPin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveToUndo();
    const newPin: PinWithComment = {
      x: pendingPin.x,
      y: pendingPin.y,
      comment: pinCommentInput.trim(),
    };
    const newPins = [...pins, newPin];
    setPins(newPins);
    drawPinWithComment(ctx, newPin.x, newPin.y, newPin.comment, newPins.length - 1);
    undoStackRef.current.push(canvas.toDataURL('image/png'));
    setPendingPin(null);
    setPinCommentInput('');
  }, [pendingPin, pinCommentInput, pins, saveToUndo, drawPinWithComment]);

  const cancelPinPlacement = useCallback(() => {
    setPendingPin(null);
    setPinCommentInput('');
  }, []);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const annotatedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const result: FrameAnnotationResult = { annotatedDataUrl };
    // Include first pin for backward compatibility
    if (pins.length > 0) {
      result.pinX = pins[0].x / canvas.width;
      result.pinY = pins[0].y / canvas.height;
      result.pinComment = pins[0].comment;
    }
    // Include all pins
    if (pins.length > 0) {
      result.pins = pins.map(p => ({
        x: p.x / canvas.width,
        y: p.y / canvas.height,
        comment: p.comment,
      }));
    }
    onSave(result);
  };

  const toolButtons: { id: AnnotationTool; label: string; icon: string }[] = [
    { id: 'brush', label: 'Draw', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    { id: 'line', label: 'Line', icon: 'M4 20L20 4' },
    { id: 'arrow', label: 'Arrow', icon: 'M5 12h14M12 5l7 7-7 7' },
    { id: 'rect', label: 'Rect', icon: 'M4 6h16v12H4V6z' },
    { id: 'circle', label: 'Circle', icon: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0' },
    { id: 'text', label: 'Text', icon: 'M4 6h16M4 12h8m-8 6h16' },
    { id: 'pin', label: 'Pin', icon: 'M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.25 7 12 8.5 12 1.5 0 8.5-6.75 8.5-12C20.5 3.81 16.69 0 12 0zm0 11.5c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z' },
  ];

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      <div className="flex items-center justify-between gap-2 p-2 border-b border-black/10 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {toolButtons.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`p-2 rounded-lg transition-colors ${
                tool === t.id ? 'bg-[#061E26] text-white' : 'bg-black/5 hover:bg-black/10 text-black'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tool === 'text' && (
            <input
              type="text"
              placeholder="Type text..."
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="px-2 py-1 text-sm border border-black/20 rounded w-32"
            />
          )}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-black ring-1 ring-offset-1' : 'border-black/20'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <select
            value={strokeSize}
            onChange={(e) => setStrokeSize(Number(e.target.value))}
            className="text-sm border border-black/20 rounded px-2 py-1"
          >
            {STROKE_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
          {pins.length > 0 && (
            <span className="text-xs text-black/60 px-2">{pins.length} pin{pins.length > 1 ? 's' : ''}</span>
          )}
          <button type="button" onClick={restoreFromUndo} className="px-2 py-1 text-xs font-medium text-black/70 hover:bg-black/10 rounded">
            Undo
          </button>
          <button type="button" onClick={clearAll} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
            Clear
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-2 min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isDrawingRef.current = false; startRef.current = null; }}
          className="max-w-full cursor-crosshair border border-black/10 rounded"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="flex justify-end gap-2 p-2 border-t border-black/10">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/5 rounded-lg">
          Cancel
        </button>
        <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-semibold text-white bg-[#061E26] hover:bg-[#061E26]/90 rounded-lg">
          Done
        </button>
      </div>

      {/* Pin comment input modal */}
      {pendingPin && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10" onClick={cancelPinPlacement}>
          <div className="bg-white rounded-xl shadow-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {pins.length + 1}
              </div>
              <h3 className="text-base font-bold text-black">Add Pin Comment</h3>
            </div>
            <textarea
              value={pinCommentInput}
              onChange={(e) => setPinCommentInput(e.target.value)}
              placeholder="What do you want to say about this point? (optional)"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-transparent resize-none mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  confirmPinWithComment();
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelPinPlacement}
                className="px-3 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPinWithComment}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-[#061E26] hover:bg-[#061E26]/90 rounded-lg"
              >
                Add Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
