import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import MaintenanceGate from './components/MaintenanceGate';

export default function App() {
  return (
    <MaintenanceGate>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </MaintenanceGate>
  );
}
