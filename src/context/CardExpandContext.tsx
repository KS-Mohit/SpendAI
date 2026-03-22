import React, { createContext, useContext, useState, useCallback } from 'react';

interface CardExpandState {
  healthScore: boolean;
  budgetGoals: boolean;
}

interface CardExpandContextType {
  expanded: CardExpandState;
  toggle: (card: keyof CardExpandState) => void;
}

const CardExpandContext = createContext<CardExpandContextType>({
  expanded: { healthScore: false, budgetGoals: false },
  toggle: () => {},
});

export function CardExpandProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState<CardExpandState>({
    healthScore: false,
    budgetGoals: false,
  });

  const toggle = useCallback((card: keyof CardExpandState) => {
    setExpanded((prev) => ({ ...prev, [card]: !prev[card] }));
  }, []);

  return (
    <CardExpandContext.Provider value={{ expanded, toggle }}>
      {children}
    </CardExpandContext.Provider>
  );
}

export const useCardExpand = () => useContext(CardExpandContext);
