import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  StyledAlertModal,
  StyledAlertButton,
  StyledAlertConfig,
} from '@/components/StyledAlertModal';

export interface ShowAlertOptions {
  type?: 'error' | 'success' | 'warning' | 'info';
  buttonText?: string;
  onConfirm?: () => void;
}

interface AlertContextType {
  showAlert: (
    title: string,
    message?: string,
    buttons?: StyledAlertButton[],
    options?: ShowAlertOptions
  ) => void;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<StyledAlertConfig>({
    visible: false,
    title: '',
    message: '',
  });

  const closeAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: StyledAlertButton[],
      options?: ShowAlertOptions
    ) => {
      setAlertConfig({
        visible: true,
        title,
        message: message || '',
        buttons,
        type: options?.type,
        buttonText: options?.buttonText || (buttons ? undefined : 'Understood'),
        onConfirm: options?.onConfirm,
      });
    },
    []
  );

  return (
    <AlertContext.Provider value={{ showAlert, closeAlert }}>
      {children}
      <StyledAlertModal config={alertConfig} onClose={closeAlert} />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
