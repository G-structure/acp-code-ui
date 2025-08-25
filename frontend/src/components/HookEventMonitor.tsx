import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  Paper,
  Typography,
  Chip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useClaudeStore } from '../store/claudeStore';

interface HookEventMonitorProps {}

const HookEventMonitor: React.FC<HookEventMonitorProps> = () => {
  const { hookEvents, clearHookEvents } = useClaudeStore();
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);

  const toggleExpanded = (index: number) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'PreToolUse':
        return 'warning';
      case 'PostToolUse':
        return 'success';
      case 'UserPromptSubmit':
        return 'info';
      case 'Error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredEvents = filter
    ? hookEvents.filter((event) => event.type === filter)
    : hookEvents;

  const eventTypeCounts = hookEvents.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Hook Events ({filteredEvents.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {Object.entries(eventTypeCounts).map(([type, count]) => (
              <Chip
                key={type}
                label={`${type} (${count})`}
                size="small"
                color={getEventColor(type) as any}
                onClick={() => setFilter(filter === type ? null : type)}
                variant={filter === type ? 'filled' : 'outlined'}
              />
            ))}
            <IconButton size="small" onClick={clearHookEvents}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List dense>
          {filteredEvents.map((event, index) => (
            <ListItem key={index} sx={{ display: 'block', p: 0, mb: 1 }}>
              <Paper
                elevation={1}
                sx={{
                  p: 1,
                  backgroundColor: '#2a2a2a',
                  cursor: 'pointer'
                }}
                onClick={() => toggleExpanded(index)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small">
                    {expandedEvents.has(index) ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                  <Chip
                    label={event.type}
                    size="small"
                    color={getEventColor(event.type) as any}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(event.timestamp)}
                  </Typography>
                  {event.data?.tool_name && (
                    <Chip
                      label={event.data.tool_name}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
                
                <Collapse in={expandedEvents.has(index)}>
                  <Box sx={{ mt: 1, p: 1, backgroundColor: '#1a1a1a', borderRadius: 1 }}>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {JSON.stringify(event.data, null, 2)}
                    </Typography>
                  </Box>
                </Collapse>
              </Paper>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default HookEventMonitor;