import React from 'react';

type Props = {
  onClick: () => void;
  children?: JSX.Element | string;
};

export const Button = ({ onClick, children }: Props) => (
  <button className="app-button" onClick={onClick}>
    {children}
  </button>
);