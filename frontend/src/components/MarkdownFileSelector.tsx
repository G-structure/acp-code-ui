import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  CircularProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Description as MarkdownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon
} from '@mui/icons-material';

interface MarkdownFile {
  name: string;
  path: string;
  size: number;
  modified: number;
}

interface MarkdownFileSelectorProps {
  workingDirectory: string | null;
  selectedFiles: string[];
  onSelectionChange: (files: string[]) => void;
}

export const MarkdownFileSelector: React.FC<MarkdownFileSelectorProps> = ({
  workingDirectory,
  selectedFiles,
  onSelectionChange
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [markdownFiles, setMarkdownFiles] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const open = Boolean(anchorEl);
  
  useEffect(() => {
    if (workingDirectory) {
      loadMarkdownFiles();
    }
  }, [workingDirectory]);
  
  const loadMarkdownFiles = async () => {
    if (!workingDirectory) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/markdown-files?path=${encodeURIComponent(workingDirectory)}`);
      if (!response.ok) {
        throw new Error('Failed to load markdown files');
      }
      const files = await response.json();
      setMarkdownFiles(files);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load markdown files:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const toggleFile = (filePath: string) => {
    const newSelection = selectedFiles.includes(filePath)
      ? selectedFiles.filter(f => f !== filePath)
      : [...selectedFiles, filePath];
    onSelectionChange(newSelection);
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return date.toLocaleDateString();
  };
  
  if (!workingDirectory) {
    return null;
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Badge 
        badgeContent={selectedFiles.length} 
        color="primary"
        invisible={selectedFiles.length === 0}
      >
        <Tooltip title={selectedFiles.length > 0 
          ? `${selectedFiles.length} markdown file(s) selected as system prompts`
          : "Select markdown files to include as system prompts"
        }>
          <IconButton
            onClick={handleClick}
            size="small"
            sx={{
              backgroundColor: selectedFiles.length > 0 
                ? 'rgba(0, 255, 255, 0.1)' 
                : 'transparent',
              '&:hover': {
                backgroundColor: selectedFiles.length > 0 
                  ? 'rgba(0, 255, 255, 0.2)' 
                  : 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            <MarkdownIcon fontSize="small" />
            {open ? <ArrowDownIcon fontSize="small" /> : <ArrowUpIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Badge>
      
      {selectedFiles.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '300px' }}>
          {selectedFiles.map(file => (
            <Chip
              key={file}
              label={file.split('/').pop()}
              size="small"
              onDelete={() => toggleFile(file)}
              sx={{
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(0, 255, 255, 0.6)',
                  '&:hover': {
                    color: '#00ffff',
                  }
                }
              }}
            />
          ))}
        </Box>
      )}
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxHeight: '400px',
            width: '350px',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 255, 255, 0.1)' }}>
          <Typography variant="subtitle2" color="primary">
            Markdown Files as System Prompts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Select files to include with your next message
          </Typography>
        </Box>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        
        {error && (
          <Box sx={{ p: 2 }}>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          </Box>
        )}
        
        {!loading && !error && markdownFiles.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography color="text.secondary" variant="body2">
              No markdown files found in the working directory
            </Typography>
          </Box>
        )}
        
        {!loading && !error && markdownFiles.length > 0 && (
          <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
            {markdownFiles.map((file) => (
              <ListItem key={file.path} disablePadding>
                <ListItemButton onClick={() => toggleFile(file.path)} dense>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedFiles.includes(file.path)}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                      sx={{
                        color: 'rgba(0, 255, 255, 0.3)',
                        '&.Mui-checked': {
                          color: '#00ffff',
                        }
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(file.size)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          •
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(file.modified)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </Box>
  );
};