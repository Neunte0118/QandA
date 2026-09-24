import React, { ReactNode } from 'react';

export const NAMED_COLOR_CLASSES: Record<string, string> = {
  red: 'text-red-600 dark:text-rose-400',
  blue: 'text-blue-600 dark:text-sky-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-yellow-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
  magenta: 'text-fuchsia-600 dark:text-fuchsia-400',
};

export interface ASTNode {
  type: 'text' | 'tag';
  text?: string;
  tag?: string; // 'red' | 'blue' | 'green' | 'yellow' | 'cyan' | 'magenta' | 'color' | 'em' | 'br'
  value?: string; // for <color value="...">
  children?: ASTNode[];
}

/**
 * Regex matching supported tags:
 * Opening:
 *  - <red>, <blue>, <green>, <yellow>, <cyan>, <magenta>, <em>, <br>
 *  - <color value="#XXXXXX"> or <color value='#XXXXXX'> or <color value=#XXXXXX> or <color="#XXXXXX">
 * Closing:
 *  - </red>, </blue>, </green>, </yellow>, </cyan>, </magenta>, </color>, </em>, </br>
 */
const TAG_REGEX =
  /<(\/?)\s*(red|blue|green|yellow|cyan|magenta|color|em|br)(?:\s+(?:value|color)?\s*=\s*(?:["']([^"']*)["']|([^\s>]+))|\s*=\s*(?:["']([^"']*)["']|([^\s>]+))|[^>]*)?\s*\/?>/gi;

/**
 * Parse input text with XML-like tags into a tree of ASTNode.
 * Robust against unclosed tags, spaces in tags, self-closing tags, and nesting.
 */
export function parseFormattedText(text: string): ASTNode[] {
  if (!text) return [];

  // Normalize HTML-entity encoded tags if present (e.g. &lt;br&gt; or &lt;br/&gt;)
  const normalizedText = text.replace(
    /&lt;(\/?\s*(?:red|blue|green|yellow|cyan|magenta|color|em|br)\b[^&;]*)(?:&gt;|>)/gi,
    '<$1>'
  );

  const root: ASTNode = { type: 'tag', tag: 'root', children: [] };
  const stack: ASTNode[] = [root];

  const regex = new RegExp(TAG_REGEX.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalizedText)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;

    // Push preceding plain text
    if (matchIndex > lastIndex) {
      const textChunk = normalizedText.substring(lastIndex, matchIndex);
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push({ type: 'text', text: textChunk });
    }

    lastIndex = matchIndex + matchLength;

    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();
    const rawValue = match[3] || match[4] || match[5] || match[6];

    // Handle line break <br>, <br/>, </br>
    if (tagName === 'br') {
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push({
        type: 'tag',
        tag: 'br',
      });
      // If immediately followed by a newline (\r\n or \n), consume it to avoid double breaks from spreadsheet cell Alt+Enter
      if (normalizedText.startsWith('\r\n', lastIndex)) {
        lastIndex += 2;
      } else if (
        normalizedText.startsWith('\n', lastIndex) ||
        normalizedText.startsWith('\r', lastIndex)
      ) {
        lastIndex += 1;
      }
      regex.lastIndex = lastIndex;
      continue;
    }

    if (isClosing) {
      // Find matching tag in stack backwards
      let foundIndex = -1;
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagName) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        // Pop down to foundIndex
        while (stack.length > foundIndex) {
          stack.pop();
        }
      } else {
        // Unmatched closing tag: render as plain text to avoid silently dropping text
        const parent = stack[stack.length - 1];
        parent.children = parent.children || [];
        parent.children.push({ type: 'text', text: match[0] });
      }
    } else {
      // Opening tag
      const newNode: ASTNode = {
        type: 'tag',
        tag: tagName,
        value: rawValue ? rawValue.trim() : undefined,
        children: [],
      };
      const parent = stack[stack.length - 1];
      parent.children = parent.children || [];
      parent.children.push(newNode);

      // Only push to stack if not self-closing (e.g. <red/>)
      const isSelfClosing = match[0].endsWith('/>');
      if (!isSelfClosing) {
        stack.push(newNode);
      }
    }
  }

  // Trailing plain text
  if (lastIndex < normalizedText.length) {
    const remainingText = normalizedText.substring(lastIndex);
    const parent = stack[stack.length - 1];
    parent.children = parent.children || [];
    parent.children.push({ type: 'text', text: remainingText });
  }

  return root.children || [];
}

interface FormatRenderContext {
  colorClass?: string;
  customColor?: string;
  isBold?: boolean;
}

/**
 * Recursively renders ASTNode array into React elements.
 */
export function renderASTNodes(
  nodes: ASTNode[],
  ctx: FormatRenderContext = {},
  keyPrefix = 'fmt'
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      if (!node.text) return null;
      const normalized = node.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (normalized.includes('\n')) {
        const lines = normalized.split('\n');
        return (
          <React.Fragment key={key}>
            {lines.map((line, lIdx) => (
              <React.Fragment key={`${key}-l-${lIdx}`}>
                {lIdx > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      }
      return <React.Fragment key={key}>{node.text}</React.Fragment>;
    }

    if (node.type === 'tag') {
      if (node.tag === 'br') {
        return <br key={key} />;
      }

      const childCtx: FormatRenderContext = { ...ctx };
      let spanClass = '';
      let spanStyle: React.CSSProperties | undefined = undefined;

      if (node.tag === 'em') {
        childCtx.isBold = true;
        spanClass += ' font-bold';
      } else if (node.tag === 'color' && node.value) {
        childCtx.customColor = node.value;
        childCtx.colorClass = undefined;
        spanStyle = { color: node.value };
      } else if (node.tag && NAMED_COLOR_CLASSES[node.tag]) {
        const colorClass = NAMED_COLOR_CLASSES[node.tag];
        childCtx.colorClass = colorClass;
        childCtx.customColor = undefined;
        spanClass += ` ${colorClass}`;
      }

      const renderedChildren = renderASTNodes(
        node.children || [],
        childCtx,
        `${key}-${node.tag}`
      );

      if (spanClass || spanStyle) {
        return (
          <span
            key={key}
            className={spanClass.trim() || undefined}
            style={spanStyle}
          >
            {renderedChildren}
          </span>
        );
      }

      return <React.Fragment key={key}>{renderedChildren}</React.Fragment>;
    }

    return null;
  });
}
