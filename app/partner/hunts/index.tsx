import React from 'react';
import { Redirect } from 'expo-router';

/** Legacy route — hunt management lives on the Field tab. */
export default function PartnerHuntsScreen() {
  return <Redirect href="/(tabs)/field" />;
}
