import React from 'react';

type Props = {
  text: string;
  children: JSX.Element | string;
};

export const Tooltip = ({ text, children }: Props) => {
  return (
    <div className="tooltip">
      {children}
      <div className="tooltip-text">{text}</div>
    </div>
  )
};