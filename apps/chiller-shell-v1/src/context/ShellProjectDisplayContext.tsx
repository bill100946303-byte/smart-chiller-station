import { createContext, type ReactNode, useContext } from "react";

const ShellProjectDisplayContext = createContext("");

type ShellProjectDisplayProviderProps = {
  value: string;
  children: ReactNode;
};

export function ShellProjectDisplayProvider({ value, children }: ShellProjectDisplayProviderProps) {
  return (
    <ShellProjectDisplayContext.Provider value={value}>
      {children}
    </ShellProjectDisplayContext.Provider>
  );
}

export function useShellProjectDisplay() {
  return useContext(ShellProjectDisplayContext);
}
