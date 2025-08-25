import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Typography,
  CircularProgress
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  InsertDriveFile as FileIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
  loading?: boolean;
}

interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (path: string) => void;
  mode?: 'files' | 'directories';
  onDirectorySelect?: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ rootPath, onFileSelect, mode = 'files', onDirectorySelect }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rootPath && rootPath.length > 0) {
      loadDirectory(rootPath);
    }
  }, [rootPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/files', {
        params: { path }
      });
      
      const nodes: FileNode[] = response.data.map((file: any) => ({
        ...file,
        children: file.type === 'directory' ? [] : undefined,
        expanded: false
      }));
      
      setFiles(nodes);
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubdirectory = async (node: FileNode) => {
    try {
      const response = await axios.get('/api/files', {
        params: { path: node.path }
      });
      
      const children: FileNode[] = response.data.map((file: any) => ({
        ...file,
        children: file.type === 'directory' ? [] : undefined,
        expanded: false
      }));
      
      updateNodeChildren(node.path, children);
    } catch (error) {
      console.error('Failed to load subdirectory:', error);
    }
  };

  const updateNodeChildren = (path: string, children: FileNode[]) => {
    setFiles((prevFiles) => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            return { ...node, children, loading: false };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return updateNode(prevFiles);
    });
  };

  const toggleNode = async (node: FileNode) => {
    // Always call onDirectorySelect when clicking a directory
    if (node.type === 'directory') {
      onDirectorySelect?.(node.path);
    }
    
    // Handle file clicks in file mode
    if (node.type === 'file' && mode === 'files') {
      onFileSelect(node.path);
      return;
    }

    // Always allow expanding/collapsing directories
    if (node.type === 'directory') {
      setFiles((prevFiles) => {
        const toggleExpanded = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((n) => {
            if (n.path === node.path) {
              const newExpanded = !n.expanded;
              if (newExpanded && n.children?.length === 0) {
                loadSubdirectory(n);
                return { ...n, expanded: newExpanded, loading: true };
              }
              return { ...n, expanded: newExpanded };
            }
            if (n.children) {
              return { ...n, children: toggleExpanded(n.children) };
            }
            return n;
          });
        };
        return toggleExpanded(prevFiles);
      });
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isDirectory = node.type === 'directory';
    const hideFiles = mode === 'directories' && node.type === 'file';
    
    if (hideFiles) return null;
    
    return (
      <React.Fragment key={node.path}>
        <ListItem
          button
          onClick={() => toggleNode(node)}
          sx={{ 
            pl: depth * 2,
            py: 0.5,
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.05)',
              borderLeft: '2px solid #00ffff'
            },
            cursor: mode === 'directories' && isDirectory ? 'pointer' : 'default'
          }}
        >
          {isDirectory && (
            <ListItemIcon sx={{ minWidth: 30 }}>
              <IconButton size="small" edge="start">
                {node.expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
            </ListItemIcon>
          )}
          <ListItemIcon sx={{ minWidth: 30 }}>
            {isDirectory ? (
              node.expanded ? <FolderOpenIcon /> : <FolderIcon />
            ) : (
              <FileIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={node.name}
            primaryTypographyProps={{
              variant: 'body2',
              noWrap: true
            }}
          />
          {node.loading && <CircularProgress size={16} />}
        </ListItem>
        {isDirectory && node.expanded && node.children && (
          <Collapse in={node.expanded}>
            <List disablePadding>
              {node.children.map((child) => renderNode(child, depth + 1)).filter(Boolean)}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" color="text.secondary">
          File Explorer
        </Typography>
        <IconButton size="small" onClick={() => loadDirectory(rootPath)}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <List dense>
          {files.map((file) => renderNode(file)).filter(Boolean)}
        </List>
      )}
    </Box>
  );
};

export default FileExplorer;