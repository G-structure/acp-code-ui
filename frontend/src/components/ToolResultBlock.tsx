import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ParsedBlock {
  tag: string;
  content: string;
}

interface ToolResultBlockProps {
  content: string;
}

// Store last detected language across all ToolResultBlock instances
let lastDetectedLanguage: string | null = null;

const ToolResultBlock: React.FC<ToolResultBlockProps> = ({ content }) => {
  // Detect file extension from content that mentions file paths
  const detectFileLanguage = (text: string): string | null => {
    // Look for patterns like "The file /path/to/file.ext has been"
    const filePathMatch = text.match(/(?:The file|File:|path:)\s+(\/[^\s]+\.[a-zA-Z]+)/);
    if (!filePathMatch) return null;
    
    const filePath = filePathMatch[1];
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    // Map file extensions to Prism language identifiers
    const extensionMap: Record<string, string> = {
      // JavaScript/TypeScript
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'mjs': 'javascript',
      'cjs': 'javascript',
      
      // Clojure/ClojureScript
      'clj': 'clojure',
      'cljs': 'clojure',
      'cljc': 'clojure',
      'edn': 'clojure',
      
      // Web
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      
      // Python
      'py': 'python',
      'pyw': 'python',
      'pyx': 'python',
      'pyi': 'python',
      
      // Shell
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      
      // Config/Data
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'xml': 'xml',
      'ini': 'ini',
      
      // Other languages
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'kt': 'kotlin',
      'swift': 'swift',
      'r': 'r',
      'R': 'r',
      'sql': 'sql',
      'md': 'markdown',
      'markdown': 'markdown',
      
      // Build/Config files
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'gradle': 'gradle',
      'cmake': 'cmake',
    };
    
    return extension ? (extensionMap[extension] || null) : null;
  };

  // Parse XML-like tags from the content
  const parseContent = (text: string): (ParsedBlock | string)[] => {
    const blocks: (ParsedBlock | string)[] = [];
    // Updated regex to support tags with hyphens (like system-reminder)
    const tagRegex = /<([\w-]+)>([\s\S]*?)<\/\1>/g;
    let lastIndex = 0;
    let match;

    const matches: Array<{ index: number; length: number; tag: string; content: string }> = [];
    
    // First, collect all matches
    while ((match = tagRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        tag: match[1],
        content: match[2].trim()
      });
    }

    // Process the text and matches
    matches.forEach((m) => {
      // Add any text before this match
      if (m.index > lastIndex) {
        const beforeText = text.substring(lastIndex, m.index).trim();
        if (beforeText) {
          blocks.push(beforeText);
        }
      }

      // Add the parsed block
      blocks.push({
        tag: m.tag,
        content: m.content
      });

      lastIndex = m.index + m.length;
    });

    // Add any remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex).trim();
      if (remainingText) {
        blocks.push(remainingText);
      }
    }

    // If no tags were found, return the original content
    if (blocks.length === 0) {
      return [text];
    }

    return blocks;
  };

  const getTagColor = (tag: string): string => {
    const colorMap: Record<string, string> = {
      status: '#00ff88',      // Green for status
      exit_code: '#ffaa00',   // Orange for exit codes
      stdout: '#00ffff',      // Cyan for stdout
      stderr: '#ff0066',      // Red for stderr
      error: '#ff0066',       // Red for errors
      timestamp: '#ff00ff',   // Magenta for timestamps
      warning: '#ffaa00',     // Orange for warnings
      info: '#00aaff',        // Blue for info
      success: '#00ff88',     // Green for success
      system: '#666666',      // Gray for system messages
      'system-reminder': '#ffaa00', // Orange for system reminders
      reminder: '#ffaa00',    // Orange for reminders
    };

    return colorMap[tag.toLowerCase()] || '#00ffff'; // Default to cyan
  };

  const getTagIcon = (tag: string): string => {
    const iconMap: Record<string, string> = {
      status: '▸',
      exit_code: '⟹',
      stdout: '›',
      stderr: '✗',
      error: '⚠',
      timestamp: '◷',
      warning: '⚡',
      info: 'ℹ',
      success: '✓',
      system: '◆',
      'system-reminder': '⚠',
      reminder: '⚠',
    };

    return iconMap[tag.toLowerCase()] || '▪';
  };

  // Check if content contains line-numbered code (e.g., "   123→ code here")
  const isLineNumberedCode = (text: string): boolean => {
    const lines = text.split('\n');
    // Check if at least 2 lines match the pattern
    let matchCount = 0;
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      if (/^\s*\d+→/.test(line)) {
        matchCount++;
        if (matchCount >= 2) return true;
      }
    }
    return false;
  };

  // Check if content is a diff (lines starting with + or -)
  const isDiffContent = (text: string): boolean => {
    const lines = text.split('\n');
    let plusCount = 0;
    let minusCount = 0;
    
    // Look for diff patterns in first 20 lines
    for (const line of lines.slice(0, 20)) {
      // Must start with exactly + or - (not multiple)
      if (/^[+](?![+])/.test(line)) plusCount++;
      if (/^[-](?![-])/.test(line)) minusCount++;
    }
    
    // Consider it a diff if we have at least 2 diff lines
    return (plusCount + minusCount) >= 2;
  };

  // Format diff content
  const formatDiffContent = (text: string) => {
    const lines = text.split('\n');
    return (
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '4px',
          margin: '8px 0',
          overflow: 'auto',
          fontFamily: '"SF Mono", "IBM Plex Mono", "Courier New", monospace',
        }}
      >
        <Box>
          {lines.map((line, i) => {
            const isAddition = /^[+](?![+])/.test(line);
            const isDeletion = /^[-](?![-])/.test(line);
            
            let bgColor = 'transparent';
            let textColor = '#e0e0e0';
            let borderLeft = 'none';
            
            if (isAddition) {
              // Subtle green background for additions
              bgColor = 'rgba(0, 255, 136, 0.08)';
              textColor = 'rgba(0, 255, 136, 0.9)';
              borderLeft = '3px solid rgba(0, 255, 136, 0.3)';
            } else if (isDeletion) {
              // Subtle red/pink background for deletions
              bgColor = 'rgba(255, 0, 102, 0.08)';
              textColor = 'rgba(255, 102, 153, 0.9)';
              borderLeft = '3px solid rgba(255, 0, 102, 0.3)';
            }
            
            return (
              <Box
                key={i}
                sx={{
                  backgroundColor: bgColor,
                  borderLeft: borderLeft,
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: isAddition 
                      ? 'rgba(0, 255, 136, 0.12)'
                      : isDeletion 
                        ? 'rgba(255, 0, 102, 0.12)'
                        : 'rgba(0, 255, 255, 0.05)'
                  }
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    margin: 0,
                    padding: '2px 12px',
                    color: textColor,
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    whiteSpace: 'pre',
                    overflow: 'visible'
                  }}
                >
                  {line || ' '}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>
    );
  };

  // Format line-numbered code with syntax highlighting
  const formatLineNumberedCode = (text: string, language: string | null) => {
    const lines = text.split('\n');
    
    // Extract just the code parts (without line numbers) for syntax highlighting
    const codeLines: string[] = [];
    const lineNumbers: string[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^(\s*)(\d+)(→)(.*)$/);
      if (match) {
        lineNumbers.push(match[2]);
        codeLines.push(match[4] || '');
      } else {
        lineNumbers.push('');
        codeLines.push(line);
      }
    });
    
    const fullCode = codeLines.join('\n');
    
    // Custom style for syntax highlighting
    const customStyle = {
      ...atomDark,
      'pre[class*="language-"]': {
        ...atomDark['pre[class*="language-"]'],
        background: 'transparent',
        margin: 0,
        padding: 0,
      },
      'code[class*="language-"]': {
        ...atomDark['code[class*="language-"]'],
        background: 'transparent',
      }
    };
    
    if (language) {
      // Use syntax highlighting
      return (
        <Paper
          elevation={0}
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            borderRadius: '4px',
            margin: '8px 0',
            overflow: 'auto',
            fontFamily: '"SF Mono", "IBM Plex Mono", "Courier New", monospace',
            position: 'relative',
          }}
        >
          {/* Language indicator */}
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            borderLeft: '1px solid rgba(0, 255, 255, 0.2)',
            borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
            borderBottomLeftRadius: '4px',
          }}>
            <Typography sx={{ 
              fontSize: '0.7rem', 
              color: 'rgba(0, 255, 255, 0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {language}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex' }}>
            {/* Line numbers column */}
            <Box sx={{ 
              borderRight: '1px solid rgba(0, 255, 255, 0.1)',
              padding: '12px 0',
              userSelect: 'none',
            }}>
              {lineNumbers.map((num, i) => (
                <Typography
                  key={i}
                  component="div"
                  sx={{
                    padding: '0 8px',
                    textAlign: 'right',
                    color: 'rgba(0, 255, 255, 0.5)',
                    fontSize: '0.85rem',
                    lineHeight: '1.5em',
                    minWidth: '50px',
                    fontFamily: 'inherit',
                    height: '1.5em',
                  }}
                >
                  {num}
                </Typography>
              ))}
            </Box>
            
            {/* Syntax highlighted code */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', padding: '12px' }}>
              <SyntaxHighlighter
                language={language}
                style={customStyle}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  fontSize: '0.9rem',
                  lineHeight: '1.5em',
                }}
                codeTagProps={{
                  style: {
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    fontFamily: '"SF Mono", "IBM Plex Mono", "Courier New", monospace',
                  }
                }}
              >
                {fullCode}
              </SyntaxHighlighter>
            </Box>
          </Box>
        </Paper>
      );
    } else {
      // Fallback to non-highlighted version
      return formatLineNumberedCodePlain(text);
    }
  };
  
  // Original plain formatting (fallback)
  const formatLineNumberedCodePlain = (text: string) => {
    const lines = text.split('\n');
    return (
      <Paper
        elevation={0}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(0, 255, 255, 0.2)',
          borderRadius: '4px',
          margin: '8px 0',
          overflow: 'auto',
          fontFamily: '"SF Mono", "IBM Plex Mono", "Courier New", monospace',
        }}
      >
        <Box sx={{ display: 'table', width: '100%', minWidth: 'max-content' }}>
          {lines.map((line, i) => {
            const match = line.match(/^(\s*)(\d+)(→)(.*)$/);
            if (match) {
              const [, spaces, lineNum, arrow, code] = match;
              return (
                <Box key={i} sx={{ display: 'table-row', '&:hover': { backgroundColor: 'rgba(0, 255, 255, 0.05)' } }}>
                  <Typography
                    component="span"
                    sx={{
                      display: 'table-cell',
                      padding: '2px 8px',
                      textAlign: 'right',
                      color: 'rgba(0, 255, 255, 0.5)',
                      fontSize: '0.85rem',
                      userSelect: 'none',
                      borderRight: '1px solid rgba(0, 255, 255, 0.1)',
                      minWidth: '50px',
                      fontFamily: 'inherit'
                    }}
                  >
                    {lineNum}
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{
                      display: 'table-cell',
                      padding: '2px 12px',
                      margin: 0,
                      color: '#e0e0e0',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      whiteSpace: 'pre',
                    }}
                  >
                    {code || ' '}
                  </Typography>
                </Box>
              );
            } else {
              // Line doesn't match pattern, show as-is
              return (
                <Box key={i} sx={{ display: 'table-row' }}>
                  <Typography
                    component="span"
                    sx={{
                      display: 'table-cell',
                      padding: '2px 8px',
                      borderRight: '1px solid rgba(0, 255, 255, 0.1)',
                    }}
                  />
                  <Typography
                    component="pre"
                    sx={{
                      display: 'table-cell',
                      padding: '2px 12px',
                      margin: 0,
                      color: '#e0e0e0',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      whiteSpace: 'pre',
                    }}
                  >
                    {line || ' '}
                  </Typography>
                </Box>
              );
            }
          })}
        </Box>
      </Paper>
    );
  };

  const parsedBlocks = parseContent(content);
  
  // Try to detect language from the entire content (usually mentioned at the beginning)
  let detectedLanguage = detectFileLanguage(content);
  
  // If we detected a language, save it as the last detected language
  if (detectedLanguage) {
    lastDetectedLanguage = detectedLanguage;
  } 
  // If no language detected, use the last detected language as fallback
  else if (lastDetectedLanguage) {
    detectedLanguage = lastDetectedLanguage;
  }

  return (
    <Box sx={{ fontFamily: '"SF Mono", "IBM Plex Mono", "Courier New", monospace' }}>
      {parsedBlocks.map((block, index) => {
        if (typeof block === 'string') {
          // Check if this is a diff
          if (isDiffContent(block)) {
            return <React.Fragment key={index}>{formatDiffContent(block)}</React.Fragment>;
          }
          // Check if this is line-numbered code
          if (isLineNumberedCode(block)) {
            return <React.Fragment key={index}>{formatLineNumberedCode(block, detectedLanguage)}</React.Fragment>;
          }
          // Regular text without tags
          return (
            <Typography
              key={index}
              component="pre"
              sx={{
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                color: '#e0e0e0',
                margin: 0,
                padding: '4px 0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6
              }}
            >
              {block}
            </Typography>
          );
        } else {
          // Structured tag block
          const tagColor = getTagColor(block.tag);
          const tagIcon = getTagIcon(block.tag);
          
          return (
            <Paper
              key={index}
              elevation={0}
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                border: `1px solid ${tagColor}33`,
                borderRadius: '4px',
                margin: '8px 0',
                overflow: 'hidden',
                boxShadow: `inset 0 0 10px ${tagColor}11`
              }}
            >
              {/* Tag header */}
              <Box
                sx={{
                  backgroundColor: `${tagColor}22`,
                  borderBottom: `1px solid ${tagColor}44`,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    color: tagColor,
                    fontSize: '0.75rem',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    textShadow: `0 0 5px ${tagColor}66`
                  }}
                >
                  {tagIcon} {block.tag}
                </Typography>
              </Box>
              
              {/* Tag content */}
              <Box sx={{ padding: '12px' }}>
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    color: block.tag === 'stderr' || block.tag === 'error' ? '#ff6666' : '#d0d0d088',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                    textShadow: block.tag === 'stderr' || block.tag === 'error' 
                      ? '0 0 3px rgba(255, 0, 102, 0.3)' 
                      : 'none'
                  }}
                >
                  {block.content || '(empty)'}
                </Typography>
              </Box>
            </Paper>
          );
        }
      })}
    </Box>
  );
};

export default ToolResultBlock;