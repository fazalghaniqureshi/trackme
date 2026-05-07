import React from "react";

interface Props {
  children: React.ReactNode;
}

const Alert: React.FC<Props> = ({ children }) => {
  return <div className="alert alert-primary">{children}</div>;
};

export default Alert;
