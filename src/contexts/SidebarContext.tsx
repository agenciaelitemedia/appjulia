import { createContext, useContext } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({ isCollapsed: false });

export function SidebarProvider({ 
  children, 
  isCollapsed 
}: { 
  children: React.ReactNode; 
  isCollapsed: boolean;
}) {
  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  return useContext(SidebarContext);
}
