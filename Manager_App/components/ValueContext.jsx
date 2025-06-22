import { createContext, useContext, useState } from 'react';

const ValueContext = createContext();

export function ValueProvider({ children }) {
  const [value, setValue] = useState(null);
  return (
    <ValueContext.Provider value={{ value, setValue }}>
      {children}
    </ValueContext.Provider>
  );
}

export function useValue() {
  return useContext(ValueContext);
}