// Custom cyberpunk theme for code syntax highlighting
export const cyberpunkCodeTheme = {
  'code[class*="language-"]': {
    color: '#00ffff',
    background: 'none',
    textShadow: '0 0 2px rgba(0, 255, 255, 0.5)',
    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
    fontSize: '0.9em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none'
  },
  'pre[class*="language-"]': {
    color: '#00ffff',
    background: '#0a0a0a',
    textShadow: '0 0 2px rgba(0, 255, 255, 0.3)',
    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
    fontSize: '0.9em',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.5',
    MozTabSize: '4',
    OTabSize: '4',
    tabSize: '4',
    WebkitHyphens: 'none',
    MozHyphens: 'none',
    msHyphens: 'none',
    hyphens: 'none',
    padding: '1em',
    margin: '0.5em 0',
    overflow: 'auto',
    borderRadius: '0.3em',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    boxShadow: 'inset 0 0 10px rgba(0, 255, 255, 0.05)'
  },
  'pre[class*="language-"]::-moz-selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'pre[class*="language-"] ::-moz-selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'code[class*="language-"]::-moz-selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'code[class*="language-"] ::-moz-selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'pre[class*="language-"]::selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'pre[class*="language-"] ::selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'code[class*="language-"]::selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  'code[class*="language-"] ::selection': {
    textShadow: 'none',
    background: 'rgba(255, 0, 255, 0.3)'
  },
  ':not(pre) > code[class*="language-"]': {
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '0.1em 0.3em',
    borderRadius: '0.3em',
    whiteSpace: 'normal',
    border: '1px solid rgba(0, 255, 255, 0.2)'
  },
  // Comments
  comment: {
    color: '#666',
    fontStyle: 'italic'
  },
  prolog: {
    color: '#666',
    fontStyle: 'italic'
  },
  doctype: {
    color: '#666',
    fontStyle: 'italic'
  },
  cdata: {
    color: '#666',
    fontStyle: 'italic'
  },
  // Punctuation
  punctuation: {
    color: '#00ffff'
  },
  // Namespaces
  namespace: {
    opacity: '0.7'
  },
  // Properties, tags, symbols
  property: {
    color: '#ff00ff'
  },
  tag: {
    color: '#ff00ff'
  },
  constant: {
    color: '#ff00ff'
  },
  symbol: {
    color: '#ff00ff'
  },
  deleted: {
    color: '#ff0066'
  },
  // Boolean, numbers
  boolean: {
    color: '#00ff88',
    textShadow: '0 0 3px rgba(0, 255, 136, 0.5)'
  },
  number: {
    color: '#00ff88',
    textShadow: '0 0 3px rgba(0, 255, 136, 0.5)'
  },
  // Selectors, attributes, strings
  selector: {
    color: '#ffaa00',
    textShadow: '0 0 3px rgba(255, 170, 0, 0.5)'
  },
  'attr-name': {
    color: '#ffaa00',
    textShadow: '0 0 3px rgba(255, 170, 0, 0.5)'
  },
  string: {
    color: '#ffaa00',
    textShadow: '0 0 3px rgba(255, 170, 0, 0.5)'
  },
  char: {
    color: '#ffaa00',
    textShadow: '0 0 3px rgba(255, 170, 0, 0.5)'
  },
  builtin: {
    color: '#ffaa00',
    textShadow: '0 0 3px rgba(255, 170, 0, 0.5)'
  },
  inserted: {
    color: '#00ff88'
  },
  // Operators, entities, URLs
  operator: {
    color: '#00ffff',
    textShadow: '0 0 3px rgba(0, 255, 255, 0.5)'
  },
  entity: {
    color: '#00ffff',
    cursor: 'help'
  },
  url: {
    color: '#00ffff'
  },
  // Language-specific selectors
  '.language-css .token.string': {
    color: '#00ffff'
  },
  '.style .token.string': {
    color: '#00ffff'
  },
  // Keywords
  atrule: {
    color: '#ff00ff',
    textShadow: '0 0 3px rgba(255, 0, 255, 0.5)'
  },
  'attr-value': {
    color: '#ffaa00'
  },
  keyword: {
    color: '#ff00ff',
    textShadow: '0 0 3px rgba(255, 0, 255, 0.5)'
  },
  // Functions
  function: {
    color: '#00ff88',
    textShadow: '0 0 3px rgba(0, 255, 136, 0.5)'
  },
  'class-name': {
    color: '#00ffff',
    textShadow: '0 0 3px rgba(0, 255, 255, 0.5)'
  },
  // Regex, important
  regex: {
    color: '#ffaa00'
  },
  important: {
    color: '#ff0066',
    fontWeight: 'bold'
  },
  variable: {
    color: '#00ffff'
  },
  // Bold and italic
  bold: {
    fontWeight: 'bold'
  },
  italic: {
    fontStyle: 'italic'
  }
};