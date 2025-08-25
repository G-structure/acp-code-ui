import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useClaudeStore } from '../store/claudeStore';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { output } = useClaudeStore();
  const lastOutputLength = useRef(0);

  useEffect(() => {
    // Only initialize once when the terminal container is ready and visible
    if (!terminalRef.current || xtermRef.current) return;
    
    // Ensure the container has dimensions
    const rect = terminalRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Retry after a delay if container has no dimensions yet
      const retryTimeout = setTimeout(() => {
        if (terminalRef.current && !xtermRef.current) {
          const newRect = terminalRef.current.getBoundingClientRect();
          if (newRect.width > 0 && newRect.height > 0) {
            initTerminal();
          }
        }
      }, 100);
      return () => clearTimeout(retryTimeout);
    }

    initTerminal();
  }, []);

  const initTerminal = () => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#50fa7b',
        brightYellow: '#f1fa8c',
        brightBlue: '#bd93f9',
        brightMagenta: '#ff79c6',
        brightCyan: '#8be9fd',
        brightWhite: '#ffffff'
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    term.open(terminalRef.current);
    
    // Delay fit to ensure terminal is properly initialized
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
    };
  };

  useEffect(() => {
    if (!xtermRef.current) return;
    
    const newOutput = output.slice(lastOutputLength.current);
    if (newOutput.length > 0) {
      for (const line of newOutput) {
        xtermRef.current.write(line);
      }
      lastOutputLength.current = output.length;
    }
  }, [output]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Box
      ref={terminalRef}
      sx={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#0a0a0a',
        padding: 1
      }}
    />
  );
};

export default Terminal;