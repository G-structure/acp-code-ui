import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';

interface ResizablePanelProps {
  children: React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  onHeightChange?: (height: number) => void;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  minHeight = 100,
  maxHeight,
  defaultHeight = 250,
  onHeightChange
}) => {
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  useEffect(() => {
    // Load saved height from localStorage
    const savedHeight = localStorage.getItem('todoPanelHeight');
    if (savedHeight) {
      const parsedHeight = parseInt(savedHeight, 10);
      if (!isNaN(parsedHeight) && parsedHeight >= minHeight && (!maxHeight || parsedHeight <= maxHeight)) {
        setHeight(parsedHeight);
      }
    }
  }, [minHeight, maxHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const containerHeight = panelRef.current?.parentElement?.clientHeight || window.innerHeight;
      const calculatedHeight = startHeightRef.current + deltaY;
      
      // Use maxHeight if provided, otherwise allow up to 80% of container height
      const effectiveMaxHeight = maxHeight || containerHeight * 0.8;
      
      const newHeight = Math.min(
        effectiveMaxHeight,
        Math.max(minHeight, calculatedHeight)
      );
      setHeight(newHeight);
      onHeightChange?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save height to localStorage
      localStorage.setItem('todoPanelHeight', height.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, height, minHeight, maxHeight, onHeightChange]);

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid rgba(0,255,255,0.15)',
        overflow: 'hidden'
      }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          cursor: 'ns-resize',
          backgroundColor: isResizing ? 'rgba(0,255,255,0.2)' : 'transparent',
          transition: 'background-color 0.2s',
          zIndex: 10,
          '&:hover': {
            backgroundColor: 'rgba(0,255,255,0.15)'
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '3px',
            borderRadius: '2px',
            backgroundColor: isResizing ? 'rgba(0,255,255,0.8)' : 'rgba(0,255,255,0.4)',
            transition: 'background-color 0.2s'
          }
        }}
      />
      
      {/* Panel content */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        pt: 1,
        px: 1,
        pb: 1,
        minHeight: 0
      }}>
        {children}
      </Box>
    </Box>
  );
};

export default ResizablePanel;