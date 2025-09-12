import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Save as SaveIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  FileCopy as FileCopyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import axios from 'axios';

interface CodeEditorProps {
  selectedFiles: string[];
  onCloseEditor: () => void;
  workingDirectory: string;
}

interface FileContent {
  path: string;
  content: string;
  language: string;
  modified: boolean;
  originalContent: string;
}

// Cyberpunk theme for Monaco Editor
const cyberpunkTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '666666', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff00ff', fontStyle: 'bold' },
    { token: 'string', foreground: 'ffaa00' },
    { token: 'number', foreground: '00ff88' },
    { token: 'regexp', foreground: 'ffaa00' },
    { token: 'operator', foreground: '00ffff' },
    { token: 'namespace', foreground: '00ffff' },
    { token: 'type', foreground: '00ffff' },
    { token: 'struct', foreground: '00ffff' },
    { token: 'class', foreground: '00ffff' },
    { token: 'interface', foreground: '00ffff' },
    { token: 'parameter', foreground: 'e0e0e0' },
    { token: 'variable', foreground: 'e0e0e0' },
    { token: 'function', foreground: '00ff88' },
    { token: 'method', foreground: '00ff88' },
    { token: 'text', foreground: 'e0e0e0' },
    { token: 'constant', foreground: 'ff00ff' },
    { token: 'property', foreground: 'ff00ff' },
    { token: 'attribute', foreground: 'ffaa00' },
    { token: 'tag', foreground: 'ff00ff' },
    { token: 'delimiter', foreground: '00ffff' },
    { token: 'punctuation', foreground: '00ffff' },
  ],
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#e0e0e0',
    'editorLineNumber.foreground': '#666666',
    'editorLineNumber.activeForeground': '#00ffff',
    'editor.selectionBackground': 'rgba(255, 0, 255, 0.3)',
    'editor.selectionHighlightBackground': 'rgba(0, 255, 255, 0.1)',
    'editorCursor.foreground': '#00ffff',
    'editorWhitespace.foreground': '#333333',
    'editorIndentGuide.background': '#1a1a1a',
    'editorIndentGuide.activeBackground': '#00ffff',
    'editorBracketMatch.background': 'rgba(0, 255, 255, 0.1)',
    'editorBracketMatch.border': '#00ffff',
    'editor.findMatchBackground': 'rgba(255, 170, 0, 0.3)',
    'editor.findMatchHighlightBackground': 'rgba(255, 170, 0, 0.1)',
    'editor.hoverHighlightBackground': 'rgba(0, 255, 255, 0.1)',
    'editor.lineHighlightBackground': 'rgba(0, 255, 255, 0.05)',
    'editorGutter.background': '#0a0a0a',
    'editorWidget.background': '#0a0a0a',
    'editorWidget.border': 'rgba(0, 255, 255, 0.2)',
    'editorSuggestWidget.background': '#0a0a0a',
    'editorSuggestWidget.border': 'rgba(0, 255, 255, 0.2)',
    'editorSuggestWidget.highlightForeground': '#00ffff',
    'editorSuggestWidget.selectedBackground': 'rgba(0, 255, 255, 0.1)',
    'scrollbarSlider.background': 'rgba(0, 255, 255, 0.3)',
    'scrollbarSlider.hoverBackground': 'rgba(0, 255, 255, 0.5)',
    'scrollbarSlider.activeBackground': '#00ffff',
  }
};

const CodeEditor: React.FC<CodeEditorProps> = ({ selectedFiles, onCloseEditor, workingDirectory }) => {
  const [files, setFiles] = useState<FileContent[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');
  const editorRef = useRef<any>(null);

  // Get file extension to determine language
  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'dockerfile': 'dockerfile',
      'txt': 'plaintext',
      'log': 'plaintext'
    };
    return languageMap[extension || ''] || 'plaintext';
  };

  // Load file content
  const loadFileContent = async (filePath: string): Promise<string> => {
    try {
      const response = await axios.get('/api/file-content', {
        params: { path: filePath }
      });
      return response.data.content || '';
    } catch (error) {
      console.error('Failed to load file content:', error);
      throw new Error(`Failed to load file: ${filePath}`);
    }
  };

  // Load all selected files
  useEffect(() => {
    const loadFiles = async () => {
      if (selectedFiles.length === 0) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const fileContents: FileContent[] = [];
        
        for (const filePath of selectedFiles) {
          try {
            const content = await loadFileContent(filePath);
            fileContents.push({
              path: filePath,
              content,
              language: getLanguageFromPath(filePath),
              modified: false,
              originalContent: content
            });
          } catch (error) {
            console.error(`Failed to load ${filePath}:`, error);
            // Add file with error content
            fileContents.push({
              path: filePath,
              content: `Error loading file: ${error}`,
              language: 'plaintext',
              modified: false,
              originalContent: ''
            });
          }
        }
        
        setFiles(fileContents);
        setActiveFileIndex(0);
      } catch (error) {
        setError('Failed to load files');
        console.error('Error loading files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [selectedFiles]);

  // Handle editor content change
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || files.length === 0) return;
    
    setFiles(prevFiles => 
      prevFiles.map((file, index) => 
        index === activeFileIndex 
          ? { ...file, content: value, modified: value !== file.originalContent }
          : file
      )
    );
  };

  // Save current file
  const saveCurrentFile = async () => {
    if (files.length === 0 || !files[activeFileIndex].modified) return;
    
    setSaving(true);
    try {
      const currentFile = files[activeFileIndex];
      await axios.post('/api/save-file', {
        path: currentFile.path,
        content: currentFile.content
      });
      
      // Update file state
      setFiles(prevFiles => 
        prevFiles.map((file, index) => 
          index === activeFileIndex 
            ? { ...file, modified: false, originalContent: file.content }
            : file
        )
      );
    } catch (error) {
      console.error('Failed to save file:', error);
      setError('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Save file as new path
  const saveFileAs = async () => {
    if (files.length === 0 || !saveAsPath.trim()) return;
    
    setSaving(true);
    try {
      const currentFile = files[activeFileIndex];
      await axios.post('/api/save-file', {
        path: saveAsPath.trim(),
        content: currentFile.content
      });
      
      // Update the file path
      setFiles(prevFiles => 
        prevFiles.map((file, index) => 
          index === activeFileIndex 
            ? { 
                ...file, 
                path: saveAsPath.trim(), 
                modified: false, 
                originalContent: file.content,
                language: getLanguageFromPath(saveAsPath.trim())
              }
            : file
        )
      );
      
      setSaveDialogOpen(false);
      setSaveAsPath('');
    } catch (error) {
      console.error('Failed to save file as:', error);
      setError('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Close file tab
  const closeFile = (index: number) => {
    if (files.length <= 1) {
      onCloseEditor();
      return;
    }
    
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    
    if (activeFileIndex >= index && activeFileIndex > 0) {
      setActiveFileIndex(activeFileIndex - 1);
    } else if (activeFileIndex >= files.length - 1) {
      setActiveFileIndex(files.length - 2);
    }
  };

  // Reload current file
  const reloadCurrentFile = async () => {
    if (files.length === 0) return;
    
    try {
      const currentFile = files[activeFileIndex];
      const content = await loadFileContent(currentFile.path);
      
      setFiles(prevFiles => 
        prevFiles.map((file, index) => 
          index === activeFileIndex 
            ? { ...file, content, originalContent: content, modified: false }
            : file
        )
      );
    } catch (error) {
      console.error('Failed to reload file:', error);
      setError('Failed to reload file');
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2
      }}>
        <CircularProgress />
        <Typography>Loading files...</Typography>
      </Box>
    );
  }

  if (files.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2
      }}>
        <Typography>No files selected for editing</Typography>
        <Button onClick={onCloseEditor} variant="outlined">
          Close Editor
        </Button>
      </Box>
    );
  }

  const currentFile = files[activeFileIndex];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 1, 
        borderBottom: 1, 
        borderColor: 'rgba(0, 255, 255, 0.2)',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'linear-gradient(90deg, #000000 0%, #0a0a0a 50%, #000000 100%)'
      }}>
        <Typography variant="h6" sx={{ 
          flexGrow: 1, 
          color: '#00ffff',
          fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", "Consolas", monospace',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textShadow: '0 0 5px rgba(0, 255, 255, 0.3)'
        }}>
          Code Editor
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Reload file">
            <IconButton 
              size="small" 
              onClick={reloadCurrentFile}
              sx={{ color: '#00ffff', '&:hover': { backgroundColor: 'rgba(0, 255, 255, 0.1)' } }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save file">
            <IconButton 
              size="small" 
              onClick={saveCurrentFile}
              disabled={!currentFile.modified || saving}
              sx={{ 
                color: currentFile.modified ? '#00ff88' : '#666666', 
                '&:hover': { backgroundColor: 'rgba(0, 255, 136, 0.1)' },
                '&:disabled': { color: '#333333' }
              }}
            >
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save as...">
            <IconButton 
              size="small" 
              onClick={() => setSaveDialogOpen(true)}
              disabled={saving}
              sx={{ 
                color: '#ffaa00', 
                '&:hover': { backgroundColor: 'rgba(255, 170, 0, 0.1)' },
                '&:disabled': { color: '#333333' }
              }}
            >
              <FileCopyIcon />
            </IconButton>
          </Tooltip>
          <IconButton 
            size="small" 
            onClick={onCloseEditor}
            sx={{ color: '#ff0066', '&:hover': { backgroundColor: 'rgba(255, 0, 102, 0.1)' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* File tabs */}
      <Box sx={{ 
        display: 'flex', 
        borderBottom: 1, 
        borderColor: 'rgba(0, 255, 255, 0.2)',
        backgroundColor: '#0a0a0a',
        overflow: 'auto'
      }}>
        {files.map((file, index) => (
          <Box
            key={file.path}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 1,
              borderRight: 1,
              borderColor: 'rgba(0, 255, 255, 0.15)',
              backgroundColor: index === activeFileIndex ? 'rgba(0, 255, 255, 0.1)' : 'transparent',
              color: index === activeFileIndex ? '#00ffff' : '#e0e0e0',
              cursor: 'pointer',
              minWidth: 0,
              flexShrink: 0,
              '&:hover': {
                backgroundColor: index === activeFileIndex ? 'rgba(0, 255, 255, 0.15)' : 'rgba(0, 255, 255, 0.05)',
                borderLeft: '2px solid #00ffff'
              }
            }}
            onClick={() => setActiveFileIndex(index)}
          >
            <EditIcon sx={{ mr: 1, fontSize: 16 }} />
            <Typography 
              variant="body2" 
              sx={{ 
                mr: 1, 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200
              }}
            >
              {file.path.split('/').pop()}
            </Typography>
            {file.modified && (
              <Chip 
                label="•" 
                size="small" 
                sx={{ 
                  minWidth: 16, 
                  height: 16, 
                  backgroundColor: 'warning.main',
                  color: 'warning.contrastText'
                }} 
              />
            )}
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                closeFile(index);
              }}
              sx={{ ml: 1, p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Editor */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Editor
          height="100%"
          language={currentFile.language}
          value={currentFile.content}
          onChange={handleEditorChange}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            
            // Define and apply the cyberpunk theme
            monaco.editor.defineTheme('cyberpunk', cyberpunkTheme);
            monaco.editor.setTheme('cyberpunk');
            
            // Configure editor with cyberpunk styling
            editor.updateOptions({
              fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", "Consolas", monospace',
              fontWeight: '400',
              letterSpacing: 0.5,
            });
          }}
          options={{
            theme: 'cyberpunk',
            fontSize: 14,
            fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", "Consolas", monospace',
            fontWeight: '400',
            letterSpacing: 0.5,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true
            },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: true,
            smoothScrolling: true,
            contextmenu: true,
            mouseWheelZoom: true,
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
              verticalScrollbarSize: 12,
              horizontalScrollbarSize: 12,
            }
          }}
        />
      </Box>

      {/* Save As Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save File As</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="File Path"
            fullWidth
            variant="outlined"
            value={saveAsPath}
            onChange={(e) => setSaveAsPath(e.target.value)}
            placeholder={currentFile.path}
            helperText="Enter the new file path"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={saveFileAs} 
            variant="contained"
            disabled={!saveAsPath.trim() || saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CodeEditor;
