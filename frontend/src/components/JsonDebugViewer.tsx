import React from 'react';
import { Box, Paper, Typography, Button, IconButton } from '@mui/material';
import { Clear as ClearIcon, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useClaudeStore } from '../store/claudeStore';

export default function JsonDebugViewer() {
  const { jsonDebugLog, clearJsonDebug } = useClaudeStore();
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());
  
  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };
  
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">JSON Debug Log ({jsonDebugLog.length} entries)</Typography>
        <Button
          startIcon={<ClearIcon />}
          onClick={clearJsonDebug}
          size="small"
          variant="outlined"
        >
          Clear
        </Button>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {jsonDebugLog.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No JSON data yet. Send a message to see the JSON stream.
          </Typography>
        ) : (
          <Box>
            {jsonDebugLog.map((entry, index) => (
              <Paper
                key={index}
                sx={{
                  mb: 1,
                  p: 1,
                  backgroundColor: '#1a1a1a',
                  border: '1px solid',
                  borderColor: entry.parsed ? '#4caf50' : '#666'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(entry.timestamp).toLocaleTimeString()} - 
                    {entry.parsed ? ` Type: ${entry.parsed.type}` : entry.raw ? ' Raw data' : ' Data'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => toggleExpanded(index)}
                  >
                    {expandedItems.has(index) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                
                {expandedItems.has(index) && (
                  <Box sx={{ mt: 1 }}>
                    <pre style={{
                      margin: 0,
                      padding: '8px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {entry.parsed ? formatJson(entry.parsed) : (entry.raw || entry.data || '')}
                    </pre>
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}