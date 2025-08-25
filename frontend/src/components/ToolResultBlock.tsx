import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

interface ParsedBlock {
  tag: string;
  content: string;
}

interface ToolResultBlockProps {
  content: string;
}

const ToolResultBlock: React.FC<ToolResultBlockProps> = ({ content }) => {
  // Parse XML-like tags from the content
  const parseContent = (text: string): (ParsedBlock | string)[] => {
    const blocks: (ParsedBlock | string)[] = [];
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
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
          fontFamily: '"IBM Plex Mono", "Courier New", monospace',
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

  // Format line-numbered code
  const formatLineNumberedCode = (text: string) => {
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
          fontFamily: '"IBM Plex Mono", "Courier New", monospace',
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

  return (
    <Box sx={{ fontFamily: '"IBM Plex Mono", "Courier New", monospace' }}>
      {parsedBlocks.map((block, index) => {
        if (typeof block === 'string') {
          // Check if this is a diff
          if (isDiffContent(block)) {
            return <React.Fragment key={index}>{formatDiffContent(block)}</React.Fragment>;
          }
          // Check if this is line-numbered code
          if (isLineNumberedCode(block)) {
            return <React.Fragment key={index}>{formatLineNumberedCode(block)}</React.Fragment>;
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
                    color: block.tag === 'stderr' || block.tag === 'error' ? '#ff6666' : '#00ff88',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                    textShadow: block.tag === 'stderr' || block.tag === 'error' 
                      ? '0 0 3px rgba(255, 0, 102, 0.3)' 
                      : '0 0 3px rgba(0, 255, 136, 0.2)'
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