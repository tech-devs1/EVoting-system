'use client';

import React from 'react';

/**
 * Shimmer skeleton block. Renders a rounded, animated placeholder that
 * mirrors the size of the content that is about to load.
 */
export default function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}
