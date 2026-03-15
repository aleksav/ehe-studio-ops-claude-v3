import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Constants from 'expo-constants';
import { colors, typography, spacing } from '@ehestudio-ops/shared';

const POLL_INTERVAL = 10_000;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ehestudio-ops-api.onrender.com';
const FRONTEND_VERSION = (Constants.expoConfig?.extra?.commitHash as string) ?? 'unknown';

interface Props {
  children: React.ReactNode;
}

export default function MaintenanceGate({ children }: Props) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'maintenance'>('loading');

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/version`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setStatus('maintenance');
        return;
      }
      const data: { version: string } = await res.json();
      setStatus(data.version === FRONTEND_VERSION ? 'ok' : 'maintenance');
    } catch {
      setStatus('maintenance');
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkVersion]);

  if (status === 'loading') {
    return null;
  }

  if (status === 'ok') {
    return <>{children}</>;
  }

  return <MaintenancePage />;
}

/* ------------------------------------------------------------------ */
/*  Animated maintenance page                                         */
/* ------------------------------------------------------------------ */

function MaintenancePage() {
  const wheelSpin = useRef(new Animated.Value(0)).current;
  const hamsterBob = useRef(new Animated.Value(0)).current;
  const dotOpacity1 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity2 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Spin the wheel
    Animated.loop(
      Animated.timing(wheelSpin, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Bob the hamster
    Animated.loop(
      Animated.sequence([
        Animated.timing(hamsterBob, {
          toValue: -6,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(hamsterBob, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Dot pulse
    const pulseDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };
    pulseDot(dotOpacity1, 0);
    pulseDot(dotOpacity2, 150);
    pulseDot(dotOpacity3, 300);
  }, [wheelSpin, hamsterBob, dotOpacity1, dotOpacity2, dotOpacity3]);

  const wheelRotation = wheelSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Wheel */}
      <View style={styles.wheelWrapper}>
        <Animated.View style={[styles.wheel, { transform: [{ rotate: wheelRotation }] }]}>
          {/* Spokes */}
          {[0, 45, 90, 135].map((deg) => (
            <View key={deg} style={[styles.spoke, { transform: [{ rotate: `${deg}deg` }] }]} />
          ))}
        </Animated.View>

        {/* Hamster */}
        <Animated.View
          style={[styles.hamsterContainer, { transform: [{ translateY: hamsterBob }] }]}
        >
          {/* Body */}
          <View style={styles.hamsterBody}>
            {/* Head */}
            <View style={styles.hamsterHead}>
              <View style={styles.hamsterEye} />
              <View style={styles.hamsterEar} />
            </View>
            {/* Tail */}
            <View style={styles.hamsterTail} />
            {/* Legs */}
            <View style={[styles.hamsterLeg, styles.hamsterFrontLeg]} />
            <View style={[styles.hamsterLeg, styles.hamsterBackLeg]} />
          </View>
        </Animated.View>
      </View>

      {/* Text */}
      <Text style={styles.title}>We're updating, back shortly</Text>
      <Text style={styles.subtitle}>
        Our hamster is running as fast as it can to deploy the latest changes. Hang tight!
      </Text>

      {/* Checking indicator */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dotOpacity1 }]} />
        <Animated.View style={[styles.dot, { opacity: dotOpacity2 }]} />
        <Animated.View style={[styles.dot, { opacity: dotOpacity3 }]} />
        <Text style={styles.checkingText}>Checking for updates...</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const WHEEL_SIZE = 160;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.divider,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: {
    position: 'absolute',
    width: WHEEL_SIZE - 6,
    height: 2,
    backgroundColor: colors.divider,
  },
  hamsterContainer: {
    zIndex: 2,
  },
  hamsterBody: {
    width: 40,
    height: 30,
    backgroundColor: colors.primary,
    borderRadius: 20,
    position: 'relative',
  },
  hamsterHead: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 20,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  hamsterEye: {
    position: 'absolute',
    top: 6,
    right: 4,
    width: 4,
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  hamsterEar: {
    position: 'absolute',
    top: -3,
    right: 3,
    width: 8,
    height: 8,
    backgroundColor: '#C4177A',
    borderRadius: 4,
  },
  hamsterTail: {
    position: 'absolute',
    top: 2,
    left: -6,
    width: 10,
    height: 7,
    backgroundColor: '#C4177A',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  hamsterLeg: {
    position: 'absolute',
    bottom: -7,
    width: 5,
    height: 12,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  hamsterFrontLeg: {
    right: 4,
  },
  hamsterBackLeg: {
    left: 6,
  },
  title: {
    fontFamily: typography.headingFamilyMobile,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.bodyFamilyMobile,
    fontSize: typography.sizes.body1,
    color: '#666',
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 4,
  },
  checkingText: {
    fontSize: typography.sizes.caption,
    color: '#999',
    marginLeft: spacing.xs,
  },
});
