import React from 'react';
import { Text, View } from 'react-native';
import { AppButton } from './ui';
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={{ flex: 1, padding: 30, justifyContent: 'center', gap: 20 }}>
        <Text>No pudimos mostrar esta pantalla. Tus datos guardados se conservan.</Text>
        <AppButton title="Volver a intentar" onPress={() => this.setState({ failed: false })} />
      </View>
    ) : (
      this.props.children
    );
  }
}
