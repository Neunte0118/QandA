import React, { useMemo } from 'react';
import { parseFormattedText, renderASTNodes } from '../utils/textFormatter';

interface FormattedTextProps {
  text: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className }) => {
  const nodes = useMemo(() => parseFormattedText(text), [text]);
  const rendered = useMemo(() => renderASTNodes(nodes), [nodes]);

  if (className) {
    return <span className={className}>{rendered}</span>;
  }

  return <>{rendered}</>;
};

export default FormattedText;
