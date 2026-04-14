import type { GraphState } from '../state.ts';

const EMERGENCY_RESPONSE = `🚨 **MEDICAL EMERGENCY DETECTED**

This sounds like a medical emergency. Please take immediate action:

1. **Call emergency services immediately**: Dial your local emergency number (911 in the US, 112 in Europe, 192 in Brazil)
2. **Do not wait** — go to the nearest emergency room if you can do so safely
3. **If unconscious or not breathing**: Begin CPR if trained
4. **Stay on the line** with emergency services until help arrives

HealthMind AI is not a substitute for emergency medical care. Please seek help immediately.`;

export function createEmergencyNode() {
  return async (_state: GraphState): Promise<Partial<GraphState>> => {
    console.log('🚨 EMERGENCY detected — escalating immediately');

    return {
      isEmergency: true,
      immediateAnswer: EMERGENCY_RESPONSE,
    };
  };
}
