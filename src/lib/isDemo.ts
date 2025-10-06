export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function demoGuard<T>(demoValue: T, realFn: () => T): T {
  try {
    if (IS_DEMO) return demoValue;
    return realFn();
  } catch (e) {
    if (IS_DEMO) return demoValue;
    throw e;
  }
}
