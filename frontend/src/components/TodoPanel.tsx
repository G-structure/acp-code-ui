import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as PendingIcon,
  PlayCircle as InProgressIcon
} from '@mui/icons-material';
import { useClaudeStore } from '../store/claudeStore';

const TodoPanel: React.FC = () => {
  const { todos } = useClaudeStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: '#00ff88' }} />;
      case 'in_progress':
        return <InProgressIcon sx={{ color: '#00aaff' }} />;
      case 'pending':
      default:
        return <PendingIcon sx={{ color: '#666' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'pending':
      default:
        return 'default';
    }
  };

  if (!todos || todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const pendingCount = todos.filter(t => t.status === 'pending').length;

  return (
    <Paper
      elevation={3}
      sx={{
        backgroundColor: '#0a0a0a',
        border: '1px solid rgba(0, 255, 255, 0.2)',
        borderRadius: 1,
        overflow: 'hidden',
        height: '100%',
        // height: (todos.length  * 60),
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          p: 1.5,
          backgroundColor: 'rgba(0, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(0, 255, 255, 0.15)'
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#00ffff', fontWeight: 600 }}>
          Claude's Tasks
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          {completedCount > 0 && (
            <Chip
              label={`${completedCount} done`}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
                color: '#00ff88',
                fontSize: '0.7rem',
                height: 15
              }}
            />
          )}
          {inProgressCount > 0 && (
            <Chip
              label={`${inProgressCount} active`}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 170, 255, 0.1)',
                color: '#00aaff',
                fontSize: '0.7rem',
                height: 20
              }}
            />
          )}
          {pendingCount > 0 && (
            <Chip
              label={`${pendingCount} pending`}
              size="small"
              sx={{
                backgroundColor: 'rgba(128, 128, 128, 0.1)',
                color: '#888',
                fontSize: '0.7rem',
                height: 20
              }}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        <List dense sx={{ py: 0 }}>
          {todos.map((todo, index) => (
            <React.Fragment key={index}>
              <ListItem
                sx={{
                  py: 0.5,
                  px: 1,
                  backgroundColor:
                    todo.status === 'in_progress'
                      ? 'rgba(0, 170, 255, 0.05)'
                      : todo.status === 'completed'
                      ? 'rgba(0, 255, 136, 0.03)'
                      : 'transparent',
                  borderRadius: 1,
                  mb: 0.5,
                  '&:hover': {
                    backgroundColor:
                      todo.status === 'in_progress'
                        ? 'rgba(0, 170, 255, 0.08)'
                        : 'rgba(0, 255, 255, 0.03)'
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {getStatusIcon(todo.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.85rem',
                        color:
                          todo.status === 'completed'
                            ? '#888'
                            : todo.status === 'in_progress'
                            ? '#00aaff'
                            : '#e0e0e0',
                        textDecoration:
                          todo.status === 'completed' ? 'line-through' : 'none',
                        fontStyle:
                          todo.status === 'in_progress' ? 'italic' : 'normal'
                      }}
                    >
                      {todo.status === 'in_progress'
                        ? todo.activeForm
                        : todo.content}
                    </Typography>
                  }
                />
              </ListItem>
              {index < todos.length - 1 && (
                <Divider
                  sx={{
                    backgroundColor: 'rgba(0, 255, 255, 0.05)',
                    my: 0.25
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </List>
      </Box>
    </Paper>
  );
};

export default TodoPanel;